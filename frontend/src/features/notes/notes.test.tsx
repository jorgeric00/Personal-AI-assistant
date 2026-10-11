import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Note, NoteSummary } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}

const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

function summary(overrides: Partial<NoteSummary>): NoteSummary {
  return {
    id: 'note-1',
    title: 'Ideas para el viaje',
    excerpt: 'Mirar vuelos a Lisboa',
    tags: ['viajes'],
    pinned: false,
    favorite: false,
    state: 'ACTIVE',
    taskCount: 0,
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-11T09:30:00Z',
    trashedAt: null,
    ...overrides,
  }
}

function note(overrides: Partial<Note>): Note {
  return {
    id: 'note-1',
    title: 'Ideas para el viaje',
    body: 'Mirar vuelos a Lisboa',
    tags: ['viajes'],
    pinned: false,
    favorite: false,
    state: 'ACTIVE',
    tasks: [],
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-11T09:30:00Z',
    trashedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('notas', () => {
  it('lista las notas y busca por texto', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/notes?view=ACTIVE': () =>
        json([summary({ pinned: true }), summary({ id: 'note-2', title: '', excerpt: 'Comprar café\nY leche', tags: [] })]),
      'GET /api/notes?view=ACTIVE&q=cafe': () => json([summary({ id: 'note-2', title: '', excerpt: 'Comprar café', tags: [] })]),
      'GET /api/note-tags': () => json([{ name: 'viajes', count: 1 }]),
    })
    renderApp('/notas')
    const user = userEvent.setup()

    const list = await screen.findByRole('list', { name: 'Notas' })
    expect(within(list).getByText('Ideas para el viaje')).toBeInTheDocument()
    expect(within(list).getByText('Fijada')).toBeInTheDocument()
    // Sin título, la primera línea hace de título
    expect(within(list).getByText('Comprar café')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '#viajes' })).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar en las notas' }), 'cafe')
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Notas' })).queryByText('Ideas para el viaje')).toBeNull())
  })

  it('guarda una nota nueva automáticamente sin duplicarla', async () => {
    const posts: unknown[] = []
    const puts: unknown[] = []
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/notes?view=ACTIVE': () => json([]),
      'GET /api/auth/csrf': csrf,
      'POST /api/notes': (init) => {
        posts.push(body(init))
        return json(note({ id: 'nueva', ...body(init) }), 201)
      },
      'PUT /api/notes/nueva': (init) => {
        puts.push(body(init))
        return json(note({ id: 'nueva', ...body(init) }))
      },
    })
    renderApp('/notas?nueva=1')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Nueva nota' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Título' }), 'Lista de la compra')
    await user.type(within(dialog).getByRole('textbox', { name: 'Contenido' }), 'Pan')
    await user.type(within(dialog).getByRole('combobox', { name: 'Etiquetas' }), '#Casa{Enter}')
    expect(within(dialog).getByText('#casa')).toBeInTheDocument()

    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Guardado'), { timeout: 3000 })
    expect(posts).toEqual([{ title: 'Lista de la compra', body: 'Pan', tags: ['casa'], taskIds: [] }])

    await user.type(within(dialog).getByRole('textbox', { name: 'Contenido' }), ' y leche')
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(puts).toEqual([{ title: 'Lista de la compra', body: 'Pan y leche', tags: ['casa'], taskIds: [] }]))
    expect(posts).toHaveLength(1)
  })

  it('no crea nada si la nota nueva se cierra vacía', async () => {
    const fetchMock = mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/notes?view=ACTIVE': () => json([]),
    })
    renderApp('/notas?nueva=1')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Nueva nota' })
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('mueve una nota a la papelera y permite deshacerlo', async () => {
    const actions: string[] = []
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/notes?view=ACTIVE': () => json([summary({})]),
      'GET /api/notes/note-1': () => json(note({})),
      'GET /api/auth/csrf': csrf,
      'POST /api/notes/note-1/trash': () => {
        actions.push('trash')
        return json(note({ state: 'TRASHED', trashedAt: '2026-10-11T10:00:00Z' }))
      },
      'POST /api/notes/note-1/restore': () => {
        actions.push('restore')
        return json(note({}))
      },
    })
    renderApp('/notas?nota=note-1')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Nota' })
    expect(within(dialog).getByRole('textbox', { name: 'Título' })).toHaveValue('Ideas para el viaje')
    await user.click(within(dialog).getByRole('button', { name: 'Mover a la papelera' }))

    await screen.findByText('Nota movida a la papelera')
    // El aviso puede aparecer un instante antes de que se cierre la hoja
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(actions).toEqual(['trash', 'restore']))
  })

  it('vacía la papelera tras confirmar', async () => {
    let emptied = false
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/notes?view=TRASH': () =>
        json(emptied ? [] : [summary({ state: 'TRASHED', trashedAt: '2026-10-10T10:00:00Z' })]),
      'GET /api/auth/csrf': csrf,
      'DELETE /api/notes/trash': () => {
        emptied = true
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/notas?vista=TRASH')
    const user = userEvent.setup()

    expect(await screen.findByText(/se borran para siempre 30 días/)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Vaciar papelera' }))
    await user.click(screen.getByRole('button', { name: 'Sí, vaciar' }))
    expect(await screen.findByText('La papelera está vacía.')).toBeInTheDocument()
    expect(emptied).toBe(true)
  })

  it('relaciona la nota nueva con la tarea desde la que se crea', async () => {
    let created: unknown = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/notes?view=ACTIVE': () => json([]),
      'GET /api/tasks?view=ALL': () =>
        json([{ id: 'task-1', kind: 'TASK', title: 'Preparar el viaje', status: 'PENDING', dueDate: '2026-10-20' }]),
      'GET /api/auth/csrf': csrf,
      'POST /api/notes': (init) => {
        created = body(init)
        return json(note({ id: 'n', ...body(init) }), 201)
      },
    })
    renderApp('/notas?nueva=1&tarea=task-1')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Nueva nota' })
    expect(await within(dialog).findByRole('button', { name: 'Preparar el viaje' })).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Título' }), 'Maleta')
    await waitFor(() => expect(created).toMatchObject({ title: 'Maleta', taskIds: ['task-1'] }), { timeout: 3000 })
  })

  it('muestra las notas fijadas y el acceso rápido en Hoy', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/notes?view=ACTIVE&pinned=true': () => json([summary({ pinned: true, title: 'Contraseña del wifi' })]),
    })
    renderApp('/')

    const section = await screen.findByRole('region', { name: 'Notas fijadas' })
    expect(await within(section).findByText('Contraseña del wifi')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nota' })).toHaveAttribute('href', '/notas?nueva=1')
  })
})
