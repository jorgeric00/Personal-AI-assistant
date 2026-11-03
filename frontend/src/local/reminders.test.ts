import { describe, expect, it } from 'vitest'

import { reminderId, zonedInstant } from './modules/reminders'
import { openTestApi } from './testing'

const task = (overrides: Record<string, unknown> = {}) => ({
  kind: 'TASK',
  title: 'Llamar al médico',
  dueDate: '2026-10-14',
  dueTime: '18:30',
  priority: 'MEDIUM',
  reminderMinutesBefore: 15,
  ...overrides,
})

describe('avisos que programa el móvil', () => {
  it('convierte la hora local a un instante, también con el cambio de hora', () => {
    expect(zonedInstant('2026-10-14', '18:30:00', 'Europe/Madrid').toISOString()).toBe('2026-10-14T16:30:00.000Z')
    // El 25 de octubre de 2026 Madrid pasa de UTC+2 a UTC+1.
    expect(zonedInstant('2026-10-26', '09:00:00', 'Europe/Madrid').toISOString()).toBe('2026-10-26T08:00:00.000Z')
  })

  it('avisa de las apariciones futuras con hora y aviso, con el texto del servidor', async () => {
    const { api, send } = await openTestApi('2026-10-14T08:00:00Z')
    await send('PATCH', '/api/me/preferences', { locale: 'es' })
    await send('POST', '/api/tasks', task())
    await send('POST', '/api/tasks', task({ title: 'Sin aviso', reminderMinutesBefore: null }))
    await send('POST', '/api/tasks', task({ title: 'Ya pasó', dueTime: '09:00' }))
    await send('POST', '/api/tasks', task({ title: 'Lejos', dueDate: '2026-12-31' }))
    const done = await send('POST', '/api/tasks', task({ title: 'Hecha' }))
    await send('POST', `/api/tasks/${done.id}/complete`, { occurrenceDate: '2026-10-14' })
    await send('POST', '/api/tasks', task({ title: 'Mañana', dueDate: '2026-10-15', dueTime: '00:10', reminderMinutesBefore: 60 }))

    const reminders = await api.reminders()
    expect(reminders.map((r) => [r.title, r.at.toISOString(), r.body])).toEqual([
      ['Llamar al médico', '2026-10-14T16:15:00.000Z', 'Hoy a las 18:30'],
      // Suena el día 14 a las 23:10, así que la tarea es «mañana».
      ['Mañana', '2026-10-14T21:10:00.000Z', 'Mañana a las 00:10'],
    ])
    expect(reminders[0].url).toBe('/tareas')
  })

  it('programa también las siguientes apariciones de una tarea que se repite', async () => {
    const { api, send } = await openTestApi('2026-10-14T08:00:00Z')
    await send(
      'POST',
      '/api/tasks',
      task({ title: 'Pastilla', dueTime: '21:00', reminderMinutesBefore: 0, recurrence: { frequency: 'DAILY', interval: 1, weekdays: [], until: '2026-10-17' } }),
    )
    const reminders = await api.reminders()
    expect(reminders.map((r) => r.at.toISOString())).toEqual([
      '2026-10-14T19:00:00.000Z',
      '2026-10-15T19:00:00.000Z',
      '2026-10-16T19:00:00.000Z',
      '2026-10-17T19:00:00.000Z',
    ])
    expect(new Set(reminders.map((r) => r.id)).size).toBe(4)
    expect(reminders.every((r) => r.id > 0 && r.id <= 0x7fffffff)).toBe(true)
  })

  it('usa identificadores estables', () => {
    expect(reminderId('task-a-2026-10-14')).toBe(reminderId('task-a-2026-10-14'))
    expect(reminderId('task-a-2026-10-14')).not.toBe(reminderId('task-a-2026-10-15'))
  })
})
