import { describe, expect, it } from 'vitest'

import { LocalError } from './errors'
import { openTestApi } from './testing'

const task = (overrides: Record<string, unknown> = {}) => ({
  kind: 'TASK',
  title: 'Comprar pan',
  description: null,
  dueDate: '2026-10-14',
  dueTime: null,
  deadline: null,
  priority: 'MEDIUM',
  categoryId: null,
  recurrence: null,
  reminderMinutesBefore: null,
  ...overrides,
})

async function failure(promise: Promise<unknown>): Promise<LocalError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof LocalError) return error
    throw error
  }
  throw new Error('no ha fallado')
}

describe('tareas en la base de datos local', () => {
  it('crea tareas, las separa en hoy y próximas y marca las atrasadas', async () => {
    const { get, send, api } = await openTestApi()
    const created = await api.request('POST', '/api/tasks', task({ title: '  Comprar pan  ', dueTime: '18:30' }))
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ title: 'Comprar pan', dueTime: '18:30:00', status: 'PENDING', overdue: false })
    await send('POST', '/api/tasks', task({ title: 'Ayer', dueDate: '2026-10-13', priority: 'HIGH' }))
    await send('POST', '/api/tasks', task({ title: 'Mañana', dueDate: '2026-10-15' }))
    await send('POST', '/api/tasks', task({ title: 'Sin fecha', dueDate: null }))

    const today = await get('/api/tasks?view=TODAY')
    expect(today.map((t: { title: string }) => t.title)).toEqual(['Ayer', 'Comprar pan'])
    expect(today[0].overdue).toBe(true)
    expect((await get('/api/tasks?view=UPCOMING')).map((t: { title: string }) => t.title)).toEqual(['Mañana'])
    expect((await get('/api/tasks')).map((t: { title: string }) => t.title)).toEqual([
      'Ayer',
      'Comprar pan',
      'Mañana',
      'Sin fecha',
    ])
  })

  it('valida como el servidor', async () => {
    const { send } = await openTestApi()
    const error = await failure(
      send('POST', '/api/tasks', task({ kind: 'REMINDER', title: ' ', dueTime: null, reminderMinutesBefore: 20000 })),
    )
    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({ title: 'task.title.required', reminderMinutesBefore: 'task.notification.invalid' })

    const second = await failure(send('POST', '/api/tasks', task({ kind: 'REMINDER', dueTime: null })))
    expect(second.fieldErrors).toEqual({ dueTime: 'task.reminder.requires-datetime' })
    expect((await failure(send('GET', '/api/tasks/nope'))).status).toBe(404)
  })

  it('una tarea recurrente avanza al completarla, salta lo atrasado y se puede deshacer', async () => {
    const { get, send } = await openTestApi()
    const created = await send(
      'POST',
      '/api/tasks',
      task({ title: 'Regar', dueDate: '2026-10-10', recurrence: { frequency: 'DAILY', interval: 2, until: null } }),
    )
    expect(created.dueDate).toBe('2026-10-10')

    const advanced = await send('POST', `/api/tasks/${created.id}/complete`, { occurrenceDate: '2026-10-10' })
    // La siguiente sería el 12, que ya pasó: salta a la primera desde hoy (14).
    expect(advanced).toMatchObject({ dueDate: '2026-10-14', status: 'PENDING' })
    expect((await failure(send('POST', `/api/tasks/${created.id}/complete`, { occurrenceDate: '2026-10-10' }))).code).toBe(
      'task-occurrence-mismatch',
    )

    const calendar = await get('/api/tasks/calendar?from=2026-10-08&to=2026-10-18')
    expect(calendar.map((e: { date: string; done: boolean }) => `${e.date}${e.done ? '✓' : ''}`)).toEqual([
      '2026-10-10✓',
      '2026-10-14',
      '2026-10-16',
      '2026-10-18',
    ])

    const undone = await send('POST', `/api/tasks/${created.id}/uncomplete`, { occurrenceDate: '2026-10-10' })
    expect(undone.dueDate).toBe('2026-10-10')
  })

  it('pospone sin dejar volver al pasado ni posponer lo hecho', async () => {
    const { send } = await openTestApi()
    const created = await send('POST', '/api/tasks', task())
    expect((await failure(send('POST', `/api/tasks/${created.id}/postpone`, { date: '2026-10-01' }))).fieldErrors).toEqual(
      { date: 'task.postpone.past' },
    )
    expect(await send('POST', `/api/tasks/${created.id}/postpone`, { date: '2026-10-20' })).toMatchObject({
      dueDate: '2026-10-20',
      status: 'POSTPONED',
    })
    await send('POST', `/api/tasks/${created.id}/complete`, { occurrenceDate: '2026-10-20' })
    expect((await failure(send('POST', `/api/tasks/${created.id}/postpone`, { date: '2026-10-21' }))).code).toBe(
      'task-already-done',
    )
  })

  it('las categorías no se repiten y al borrarlas las tareas se quedan sin categoría', async () => {
    const { get, send } = await openTestApi()
    const home = await send('POST', '/api/task-categories', { name: 'Casa', color: '#0f766e' })
    await send('POST', '/api/task-categories', { name: 'Ánimo', color: '#2563eb' })
    expect((await failure(send('POST', '/api/task-categories', { name: 'ÁNIMO', color: '#2563eb' }))).fieldErrors).toEqual(
      { name: 'task.category.name.duplicate' },
    )
    const created = await send('POST', '/api/tasks', task({ categoryId: home.id }))
    expect(created.category).toEqual({ id: home.id, name: 'Casa', color: '#0f766e' })
    expect((await get('/api/task-categories')).map((c: { name: string }) => c.name)).toEqual(['Ánimo', 'Casa'])

    await send('DELETE', `/api/task-categories/${home.id}`)
    expect((await get(`/api/tasks/${created.id}`)).category).toBeNull()
  })

  it('lo guardado sigue ahí al volver a abrir la app y un fallo no deja cambios a medias', async () => {
    const first = await openTestApi()
    const created = await first.send('POST', '/api/tasks', task())
    await failure(first.send('PUT', `/api/tasks/${created.id}`, task({ title: '' })))

    const reopened = await openTestApi('2026-10-14T09:00:00Z', first.storage)
    expect((await reopened.get(`/api/tasks/${created.id}`)).title).toBe('Comprar pan')
  })

  it('responde que una parte aún no está disponible', async () => {
    const { get } = await openTestApi()
    expect((await failure(get('/api/finance/summary?month=2026-10'))).code).toBe('not-available')
  })
})
