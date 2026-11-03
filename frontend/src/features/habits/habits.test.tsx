import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Habit } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}
const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

const habit = (overrides: Partial<Habit>): Habit => ({
  id: 'h1',
  name: 'Leer',
  color: '#0f766e',
  frequency: 'DAILY',
  weekdays: [],
  timesPerWeek: null,
  startDate: '2026-10-01',
  archived: false,
  reminderTime: null,
  checks: [],
  ...overrides,
})

// Miércoles 14 de octubre de 2026
const habits: Habit[] = [
  habit({ checks: ['2026-10-12', '2026-10-13'] }),
  habit({ id: 'h2', name: 'Caminar', color: '#2563eb', frequency: 'WEEKLY', timesPerWeek: 3, checks: ['2026-10-13'] }),
  habit({ id: 'h3', name: 'Tocar la guitarra', archived: true }),
]

const base = {
  'GET /api/auth/me': () => json(testUser),
  'GET /api/auth/csrf': csrf,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('hábitos', () => {
  it('marca días de esta semana y muestra el progreso sin días futuros', async () => {
    let checked: string | null = null
    mockFetch({
      ...base,
      'GET /api/habits?from=2026-07-27&to=2026-10-18': () =>
        json(checked ? [{ ...habits[0], checks: [...habits[0].checks, checked] }, ...habits.slice(1)] : habits),
      'PUT /api/habits/h1/checks/2026-10-14': () => {
        checked = '2026-10-14'
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/habitos')
    const user = userEvent.setup()

    const week = (await screen.findByRole('heading', { name: 'Esta semana' })).closest('section')!
    const reading = within(week).getByRole('button', { name: /^Leer\s*Cada día/ }).closest('li')!
    expect(reading).toHaveTextContent('Cada día')
    expect(reading).toHaveTextContent('2 de 7')
    expect(within(reading).getByRole('button', { name: 'Leer, lun, 12 oct' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(reading).getByRole('button', { name: 'Leer, jue, 15 oct' })).toBeDisabled()
    await user.click(within(reading).getByRole('button', { name: 'Leer, mié, 14 oct' }))
    await waitFor(() => expect(reading).toHaveTextContent('3 de 7'))
    await waitFor(() => expect(checked).toBe('2026-10-14'))

    const walking = within(week).getByRole('button', { name: /^Caminar\s*3 veces/ }).closest('li')!
    expect(walking).toHaveTextContent('3 veces por semana')
    expect(walking).toHaveTextContent('1 de 3')

    // Los archivados no salen en la semana, pero se conservan
    expect(within(week).queryByText('Tocar la guitarra')).not.toBeInTheDocument()
    expect(screen.getByText('Archivado (1)')).toBeInTheDocument()

    const history = screen.getByRole('heading', { name: 'Cómo va' }).closest('section')!
    expect(history).toHaveTextContent('3 días cumplidos en 12 semanas')
  })

  it('crea un hábito semanal', async () => {
    let saved: unknown = null
    mockFetch({
      ...base,
      'GET /api/habits?from=2026-07-27&to=2026-10-18': () => json([]),
      'POST /api/habits': (init) => {
        saved = body(init)
        return json(habit({ id: 'h9', name: 'Nadar', frequency: 'WEEKLY', timesPerWeek: 2 }), 201)
      },
    })
    renderApp('/habitos')
    const user = userEvent.setup()

    expect(await screen.findByText(/Aún no tienes hábitos/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nuevo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo hábito' })
    await user.type(within(dialog).getByLabelText('Nombre'), 'Nadar')
    await user.click(within(dialog).getByRole('radio', { name: 'Veces por semana' }))
    await user.selectOptions(within(dialog).getByLabelText('Cuántas veces'), '2')
    fireEvent.change(within(dialog).getByLabelText('Recordarme a las'), { target: { value: '21:30' } })
    // Sin notificaciones activas en este dispositivo, el aviso no llegaría
    expect(await within(dialog).findByText(/Las notificaciones están desactivadas/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(saved).toEqual({
        name: 'Nadar',
        color: '#0f766e',
        frequency: 'WEEKLY',
        weekdays: [],
        timesPerWeek: 2,
        archived: false,
        reminderTime: '21:30',
      }),
    )
  })

  it('pide confirmación antes de borrar el historial', async () => {
    let deleted = false
    mockFetch({
      ...base,
      'GET /api/habits?from=2026-07-27&to=2026-10-18': () => json(habits),
      'DELETE /api/habits/h1': () => {
        deleted = true
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/habitos?habito=h1')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Editar hábito' })
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    expect(within(dialog).getByText(/Si solo quieres dejar de verlo, archívalo/)).toBeInTheDocument()
    expect(deleted).toBe(false)
    await user.click(within(dialog).getByRole('button', { name: 'Borrar con su historial' }))
    await waitFor(() => expect(deleted).toBe(true))
  })

  it('en Hoy muestra los hábitos de hoy y los semanales sin completar', async () => {
    let checked = false
    mockFetch({
      ...base,
      'GET /api/habits?from=2026-10-12&to=2026-10-18': () =>
        json([...habits, habit({ id: 'h4', name: 'Gimnasio', weekdays: ['MONDAY'] })]),
      'PUT /api/habits/h2/checks/2026-10-14': () => {
        checked = true
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/')
    const user = userEvent.setup()

    const section = (await screen.findByRole('heading', { name: 'Hábitos' })).closest('section')!
    expect(within(section).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Leer', 'Caminar1 de 3'])
    await user.click(within(section).getByRole('button', { name: 'Hecho hoy: Caminar' }))
    await waitFor(() => expect(checked).toBe(true))
  })
})
