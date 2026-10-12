import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Task } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    kind: 'TASK',
    title: 'Comprar pan',
    description: null,
    dueDate: '2026-10-11',
    dueTime: null,
    deadline: null,
    priority: 'MEDIUM',
    category: null,
    status: 'PENDING',
    recurrence: null,
    reminderMinutesBefore: null,
    overdue: false,
    completedAt: null,
    ...overrides,
  }
}

const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

beforeEach(() => {
  // Domingo 11 de octubre de 2026, mediodía en Madrid
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('lista de tareas', () => {
  it('agrupa las atrasadas y las de hoy', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/tasks?view=TODAY': () =>
        json([
          task({ id: 'a', title: 'Pagar el seguro', dueDate: '2026-10-09', overdue: true }),
          task({ id: 'b', title: 'Comprar pan', dueTime: '18:30:00', priority: 'HIGH' }),
        ]),
    })
    renderApp('/tareas')

    const overdue = await screen.findByRole('region', { name: 'Atrasadas' })
    expect(within(overdue).getByText('Pagar el seguro')).toBeInTheDocument()
    const today = screen.getByRole('region', { name: 'Hoy' })
    expect(within(today).getByText('Comprar pan')).toBeInTheDocument()
    expect(within(today).getByText('Hoy, 18:30')).toBeInTheDocument()
  })

  it('muestra un estado vacío útil', async () => {
    mockFetch({ 'GET /api/auth/me': () => json(testUser) })
    renderApp('/tareas')
    expect(await screen.findByText('Nada para hoy. Añade una tarea o disfruta del día.')).toBeInTheDocument()
  })

  it('completa una tarea con un toque y permite deshacer', async () => {
    const calls: string[] = []
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/tasks?view=TODAY': () => json([task({})]),
      'GET /api/auth/csrf': csrf,
      'POST /api/tasks/task-1/complete': (init) => {
        calls.push(`complete ${body(init).occurrenceDate}`)
        return json(task({ status: 'DONE' }))
      },
      'POST /api/tasks/task-1/uncomplete': (init) => {
        calls.push(`uncomplete ${body(init).occurrenceDate}`)
        return json(task({}))
      },
    })
    renderApp('/tareas')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Completar «Comprar pan»' }))
    expect(await screen.findByText('Tarea completada')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))

    await waitFor(() => expect(calls).toEqual(['complete 2026-10-11', 'uncomplete 2026-10-11']))
  })

  it('cambia de vista y filtra desde la URL', async () => {
    const fetchMock = mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/task-categories': () => json([{ id: 'c1', name: 'Casa', color: '#0f766e' }]),
      'GET /api/tasks?view=UPCOMING': () => json([task({ id: 'x', title: 'Llamar a mamá', dueDate: '2026-10-12' })]),
      'GET /api/tasks?view=UPCOMING&categoryId=c1': () => json([]),
    })
    const { router } = renderApp('/tareas')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Próximas' }))
    expect(await screen.findByRole('region', { name: 'Mañana' })).toHaveTextContent('Llamar a mamá')

    await user.selectOptions(screen.getByLabelText('Categoría'), 'c1')
    expect(await screen.findByText('Ninguna tarea coincide con los filtros.')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?vista=UPCOMING&categoria=c1')
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks?view=UPCOMING&categoryId=c1', expect.anything())
  })
})

describe('editor de tareas', () => {
  it('crea una tarea para hoy por defecto', async () => {
    let created: Record<string, unknown> = {}
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/auth/csrf': csrf,
      'POST /api/tasks': (init) => {
        created = body(init)
        return json(task({ title: created.title as string }), 201)
      },
    })
    renderApp('/tareas')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Nueva' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva tarea' })
    await user.type(within(dialog).getByLabelText('Título'), '  Regar las plantas ')
    await user.click(within(dialog).getByRole('radio', { name: 'Alta' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(created).toMatchObject({
      kind: 'TASK',
      title: 'Regar las plantas',
      dueDate: '2026-10-11',
      dueTime: null,
      priority: 'HIGH',
      recurrence: null,
      reminderMinutesBefore: null,
    })
    expect(screen.getByText('Guardado')).toBeInTheDocument()
  })

  it('crea un recordatorio que se repite con aviso', async () => {
    let created: Record<string, unknown> = {}
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/auth/csrf': csrf,
      'POST /api/tasks': (init) => {
        created = body(init)
        return json(task({}), 201)
      },
    })
    renderApp('/tareas?nueva=REMINDER')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Nuevo recordatorio' })
    await user.type(within(dialog).getByLabelText('Título'), 'Pádel')
    await user.type(within(dialog).getByLabelText('Hora'), '19:00')
    await user.selectOptions(within(dialog).getByLabelText('Aviso'), '30')
    await user.selectOptions(within(dialog).getByLabelText('Repetir'), 'custom')
    await user.clear(within(dialog).getByLabelText('Cada'))
    await user.type(within(dialog).getByLabelText('Cada'), '2')
    await user.click(within(dialog).getByRole('button', { name: 'lun' }))
    await user.click(within(dialog).getByRole('button', { name: 'jue' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(created).toMatchObject({
        kind: 'REMINDER',
        title: 'Pádel',
        dueTime: '19:00',
        reminderMinutesBefore: 30,
        recurrence: { frequency: 'WEEKLY', interval: 2, weekdays: ['MONDAY', 'THURSDAY'], until: null },
      }),
    )
  })

  it('muestra los errores de validación del servidor junto al campo', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/auth/csrf': csrf,
      'POST /api/tasks': () =>
        json({ title: 'Datos no válidos', detail: 'Revisa', errors: { title: 'Escribe un título' } }, 400),
    })
    renderApp('/tareas?nueva=TASK')
    const user = userEvent.setup()

    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Escribe un título')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('pospone una tarea a mañana', async () => {
    let postponedTo = ''
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/tasks/task-1': () => json(task({})),
      'GET /api/auth/csrf': csrf,
      'POST /api/tasks/task-1/postpone': (init) => {
        postponedTo = body(init).date
        return json(task({ status: 'POSTPONED', dueDate: postponedTo }))
      },
    })
    const { router } = renderApp('/tareas?tarea=task-1')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Editar' })
    expect(within(dialog).getByLabelText('Título')).toHaveValue('Comprar pan')
    await user.click(within(dialog).getByRole('button', { name: 'A mañana' }))

    await waitFor(() => expect(postponedTo).toBe('2026-10-12'))
    expect(await screen.findByText('Pospuesta: Mañana')).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('pide confirmación antes de eliminar', async () => {
    const deleted = vi.fn()
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/tasks/task-1': () => json(task({})),
      'GET /api/auth/csrf': csrf,
      'DELETE /api/tasks/task-1': () => {
        deleted()
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/tareas?tarea=task-1')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(deleted).not.toHaveBeenCalled()
    expect(screen.getByText('¿Eliminar esta tarea? No se puede deshacer.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }))

    await waitFor(() => expect(deleted).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Eliminado')).toBeInTheDocument()
  })

  it('cierra con Escape', async () => {
    mockFetch({ 'GET /api/auth/me': () => json(testUser) })
    renderApp('/tareas?nueva=TASK')
    const user = userEvent.setup()
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('calendario', () => {
  it('muestra el mes con las apariciones y la lista del día elegido', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/tasks/calendar?from=2026-09-28&to=2026-11-08': () =>
        json([
          {
            taskId: 'p',
            date: '2026-10-13',
            time: '19:00:00',
            title: 'Pádel',
            kind: 'REMINDER',
            priority: 'MEDIUM',
            category: null,
            done: false,
            recurring: true,
          },
        ]),
    })
    renderApp('/tareas?vista=CALENDAR')
    const user = userEvent.setup()

    expect(await screen.findByRole('heading', { name: 'Octubre de 2026' })).toBeInTheDocument()
    expect(screen.getByText('Nada para este día.')).toBeInTheDocument()

    await user.click(await screen.findByRole('gridcell', { name: /mar, 13 oct, 1 elemento/ }))
    expect(screen.getByRole('button', { name: /19:00\s*Pádel/ })).toBeInTheDocument()
  })
})

describe('inicio', () => {
  it('resume las tareas de hoy y los próximos recordatorios', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/tasks?view=TODAY': () => json([task({})]),
      'GET /api/tasks?view=UPCOMING&kind=REMINDER': () =>
        json([task({ id: 'r', kind: 'REMINDER', title: 'Dentista', dueDate: '2026-10-12', dueTime: '09:30:00' })]),
    })
    renderApp('/')

    const today = await screen.findByRole('region', { name: 'Para hoy' })
    expect(await within(today).findByText('Comprar pan')).toBeInTheDocument()
    const reminders = screen.getByRole('region', { name: 'Próximos recordatorios' })
    expect(await within(reminders).findByText('Dentista')).toBeInTheDocument()
    expect(within(reminders).getByText('Mañana, 09:30')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Recordatorio' })).toHaveAttribute('href', '/tareas?nueva=REMINDER')
  })
})
