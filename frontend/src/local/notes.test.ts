import { describe, expect, it } from 'vitest'

import { failure, openTestApi } from './testing'

const note = (overrides: Record<string, unknown> = {}) => ({
  title: 'Ideas',
  body: 'Ir al **mercado**',
  tags: [],
  taskIds: [],
  ...overrides,
})

describe('notas en la base de datos local', () => {
  it('crea notas, normaliza etiquetas y busca sin tildes ni mayúsculas', async () => {
    const { api, get, send } = await openTestApi()
    const created = await api.request('POST', '/api/notes', note({ title: '  Café  ', tags: ['#Viajes', 'viajes', ' Casa  nueva '] }))
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ title: 'Café', tags: ['casa nueva', 'viajes'], state: 'ACTIVE', pinned: false })
    await send('POST', '/api/notes', note({ title: 'Otra', body: 'Nada que ver', tags: ['casa nueva'] }))

    expect((await get('/api/notes?q=CAFE')).map((n: any) => n.title)).toEqual(['Café'])
    expect((await get('/api/notes?q=mercado%20cafe')).map((n: any) => n.title)).toEqual(['Café'])
    expect((await get('/api/notes?tag=%23Viajes')).map((n: any) => n.title)).toEqual(['Café'])
    expect(await get('/api/note-tags')).toEqual([
      { name: 'casa nueva', count: 2 },
      { name: 'viajes', count: 1 },
    ])
  })

  it('valida como el servidor', async () => {
    const { send } = await openTestApi()
    const empty = await failure(send('POST', '/api/notes', note({ title: ' ', body: '  ' })))
    expect(empty.fieldErrors).toEqual({ body: 'note.empty' })
    const longTag = await failure(send('POST', '/api/notes', note({ tags: ['x'.repeat(41)] })))
    expect(longTag.fieldErrors).toEqual({ tags: 'note.tags.too-long' })
    const missingTask = await failure(send('POST', '/api/notes', note({ taskIds: ['no-existe'] })))
    expect(missingTask.fieldErrors).toEqual({ taskIds: 'note.tasks.invalid' })
  })

  it('relaciona tareas y las quita si se borra la tarea', async () => {
    const { get, send } = await openTestApi()
    const task = await send('POST', '/api/tasks', {
      kind: 'TASK',
      title: 'Llamar al banco',
      dueDate: '2026-10-14',
      priority: 'MEDIUM',
    })
    const created = await send('POST', '/api/notes', note({ taskIds: [task.id] }))
    expect(created.tasks).toEqual([
      { id: task.id, title: 'Llamar al banco', kind: 'TASK', status: 'PENDING', dueDate: '2026-10-14' },
    ])
    expect((await get(`/api/notes?taskId=${task.id}`)).map((n: any) => n.taskCount)).toEqual([1])

    await send('DELETE', `/api/tasks/${task.id}`)
    expect((await get(`/api/notes/${created.id}`)).tasks).toEqual([])
  })

  it('fija, archiva, manda a la papelera y borra con las mismas reglas', async () => {
    const { get, send } = await openTestApi()
    const first = await send('POST', '/api/notes', note({ title: 'Primera' }))
    const second = await send('POST', '/api/notes', note({ title: 'Segunda' }))
    await send('PATCH', `/api/notes/${first.id}`, { pinned: true, favorite: true })
    expect((await get('/api/notes')).map((n: any) => n.title)).toEqual(['Primera', 'Segunda'])
    expect((await get('/api/notes?pinned=true')).map((n: any) => n.title)).toEqual(['Primera'])

    const archived = await send('POST', `/api/notes/${first.id}/archive`)
    expect(archived).toMatchObject({ state: 'ARCHIVED', pinned: false })
    expect((await failure(send('PATCH', `/api/notes/${first.id}`, { pinned: true }))).code).toBe('note-archived')
    expect((await get('/api/notes?view=FAVORITES')).map((n: any) => n.title)).toEqual(['Primera'])

    expect((await failure(send('DELETE', `/api/notes/${second.id}`))).code).toBe('note-not-in-trash')
    const trashed = await send('POST', `/api/notes/${second.id}/trash`)
    expect(trashed.trashedAt).not.toBeNull()
    expect((await failure(send('PUT', `/api/notes/${second.id}`, note()))).code).toBe('note-in-trash')
    expect((await get('/api/notes?view=TRASH')).map((n: any) => n.title)).toEqual(['Segunda'])

    const restored = await send('POST', `/api/notes/${second.id}/restore`)
    expect(restored).toMatchObject({ state: 'ACTIVE', trashedAt: null })
    await send('POST', `/api/notes/${second.id}/trash`)
    await send('DELETE', '/api/notes/trash')
    expect(await get('/api/notes?view=TRASH')).toEqual([])
    expect(await get(`/api/notes/${first.id}`)).toMatchObject({ title: 'Primera' })
  })

  it('vacía la papelera a los 30 días al abrir la app', async () => {
    const { send, storage } = await openTestApi('2026-10-01T08:00:00Z')
    const old = await send('POST', '/api/notes', note({ title: 'Vieja' }))
    await send('POST', `/api/notes/${old.id}/trash`)

    const tooSoon = await openTestApi('2026-10-30T08:00:00Z', storage)
    expect(await tooSoon.get('/api/notes?view=TRASH')).toHaveLength(1)
    const later = await openTestApi('2026-11-01T08:00:00Z', storage)
    expect(await later.get('/api/notes?view=TRASH')).toEqual([])
  })
})
