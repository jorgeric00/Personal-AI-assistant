import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { AgendaCategory, AgendaItem } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}
const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

const sport = { id: 'c1', name: 'Pádel y deporte', color: '#16a34a' }
const friends = { id: 'c2', name: 'Amigos', color: '#db2777' }
const travel = { id: 'c3', name: 'Viajes', color: '#0284c7' }
const categories: AgendaCategory[] = [
  { ...friends, archived: false, inUse: true },
  { ...sport, archived: false, inUse: true },
  { ...travel, archived: false, inUse: false },
  { id: 'c4', name: 'Antigua', color: '#64748b', archived: true, inUse: false },
]

function item(overrides: Partial<AgendaItem>): AgendaItem {
  const date = overrides.date ?? '2026-10-13'
  return {
    kind: 'ACTIVITY',
    id: 'a1',
    date,
    title: 'Pádel',
    category: sport,
    startDate: date,
    startTime: '19:00:00',
    endDate: date,
    endTime: '20:30:00',
    location: null,
    status: 'PLANNED',
    recurring: false,
    ...overrides,
  }
}

// Miércoles 14 de octubre de 2026: la semana va del lunes 12 al domingo 18
const week: AgendaItem[] = [
  item({ kind: 'WORKOUT', id: 'w1', date: '2026-10-12', title: 'Pierna', category: null, startTime: null, endTime: null, status: 'DONE' }),
  item({ status: 'DONE', recurring: true, location: 'Club' }),
  item({ id: 'a2', title: 'Cena', category: friends, startTime: '20:00:00', endTime: '22:00:00' }),
  item({ kind: 'ROUTINE', id: 'r1', date: '2026-10-14', title: 'Torso', category: null, startTime: null, endTime: null, recurring: true }),
  item({ id: 'a3', date: '2026-10-16', title: 'Escapada', category: travel, endDate: '2026-10-18', startTime: null, endTime: null }),
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('agenda', () => {
  it('muestra la semana con entrenos, avisos de solapamiento y el resumen, y marca lo hecho', async () => {
    let status: unknown = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/agenda?from=2026-10-12&to=2026-10-18': () => json(week),
      'GET /api/auth/csrf': csrf,
      'PUT /api/agenda/activities/a2/occurrences/2026-10-13': (init) => {
        status = body(init)
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/agenda')
    const user = userEvent.setup()

    const tuesday = (await screen.findByRole('heading', { name: 'Ayer · mar, 13 oct' })).closest('section')!
    const rows = within(tuesday).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('19:00–20:30Pádel')
    expect(rows[0]).toHaveTextContent('Hecha · Pádel y deporte · Club')
    expect(rows[1]).toHaveTextContent('Cena')
    expect(within(tuesday).getAllByText('⚠ Se solapa con otra actividad')).toHaveLength(2)

    const monday = screen.getByRole('heading', { name: 'lun, 12 oct' }).closest('section')!
    expect(monday).toHaveTextContent('EntrenoPiernaEntreno hecho')
    const today = screen.getByRole('heading', { name: 'Hoy · mié, 14 oct' }).closest('section')!
    expect(today).toHaveTextContent('TorsoToca rutina')
    // Un viaje de varios días aparece en cada uno
    expect(screen.getAllByText('Escapada')).toHaveLength(3)
    expect(screen.getByRole('heading', { name: 'dom, 18 oct' }).closest('section')).toHaveTextContent('desde vie, 16 oct')

    const summary = screen.getByRole('heading', { name: 'Resumen de la semana' }).closest('section')!
    // Hechos: el entreno y el pádel; la cena de ayer está sin marcar; la rutina de hoy aún no cuenta
    expect(summary).toHaveTextContent('2 de 3 hechas')
    expect(summary).toHaveTextContent('1 sin marcar')
    expect(summary).toHaveTextContent('AmigosPlanificado 2 h')
    expect(summary).toHaveTextContent('Pádel y deportePlanificado 1 h 30 min · hecho 1 h 30 min')

    await user.click(within(rows[1]).getByRole('button', { name: 'Marcar «Cena» como hecha' }))
    await waitFor(() => expect(status).toEqual({ status: 'DONE' }))
    expect(await screen.findByText('Marcada como «Hecha»')).toBeInTheDocument()
  })

  it('avisa de que una actividad nueva se solapa pero deja guardarla', async () => {
    let saved: unknown = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/agenda?from=2026-10-12&to=2026-10-18': () => json([]),
      'GET /api/agenda/categories': () => json(categories),
      'GET /api/agenda?from=2026-10-14&to=2026-10-14': () =>
        json([item({ date: '2026-10-14' }), item({ id: 'a9', date: '2026-10-14', title: 'Cancelada', status: 'CANCELLED' })]),
      'GET /api/auth/csrf': csrf,
      'POST /api/agenda/activities': (init) => {
        saved = body(init)
        return json({}, 201)
      },
    })
    renderApp('/agenda?actividad=nueva')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Título'), 'Cena con Ana')
    const category = screen.getByLabelText('Categoría')
    // Las archivadas no se ofrecen para actividades nuevas
    expect(within(category).queryByRole('option', { name: 'Antigua' })).not.toBeInTheDocument()
    await user.selectOptions(category, 'c2')
    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '20:00' } })
    fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '22:00' } })
    await user.type(screen.getByLabelText('Ubicación'), 'Casa')

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Coincide con otras actividades')
    expect(alert).toHaveTextContent('Pádel · mié, 14 oct 19:00–20:30')
    expect(alert).not.toHaveTextContent('Cancelada')
    expect(saved).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Guardar igualmente' }))
    await waitFor(() =>
      expect(saved).toEqual({
        title: 'Cena con Ana',
        categoryId: 'c2',
        startDate: '2026-10-14',
        startTime: '20:00',
        endDate: '2026-10-14',
        endTime: '22:00',
        description: null,
        location: 'Casa',
        recurrence: null,
      }),
    )
  })

  it('en la vista mensual muestra la lista del día elegido', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/agenda?from=2026-09-28&to=2026-11-08': () => json(week),
    })
    renderApp('/agenda?vista=MONTH')
    const user = userEvent.setup()

    expect(await screen.findByRole('heading', { name: 'Octubre de 2026' })).toBeInTheDocument()
    await user.click(await screen.findByRole('gridcell', { name: 'Ayer, 2 elementos' }))
    const list = screen.getByRole('heading', { name: 'Ayer' }).closest('section')!
    expect(within(list).getAllByRole('listitem').map((li) => li.querySelector('.agenda-item-title')?.textContent)).toEqual([
      'Pádel',
      'Cena',
    ])
  })
})

describe('agenda en Hoy', () => {
  it('muestra las actividades de hoy y abre la agenda al pulsar una', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/agenda?from=2026-10-14&to=2026-10-14': () =>
        json([item({ id: 'a5', date: '2026-10-14', title: 'Dentista', category: null, startTime: '17:00:00', endTime: '17:30:00' }), week[3]]),
      'GET /api/finance/summary?month=2026-10': () =>
        json({ month: '2026-10', currency: 'EUR', totals: { incomeCents: 0, expenseCents: 0, balanceCents: 0 }, previousMonth: '2026-09', previousTotals: { incomeCents: 0, expenseCents: 0, balanceCents: 0 }, byCategory: [] }),
      'GET /api/agenda/activities/a5': () =>
        json({ id: 'a5', title: 'Dentista', category: friends, startDate: '2026-10-14', startTime: '17:00:00', endDate: '2026-10-14', endTime: '17:30:00', description: null, location: null, recurrence: null }),
      'GET /api/agenda/categories': () => json(categories),
    })
    const { router } = renderApp('/')
    const user = userEvent.setup()

    const section = (await screen.findByRole('heading', { name: 'Agenda de hoy' })).closest('section')!
    // Los entrenos tienen su propia sección en Hoy
    expect(within(section).getAllByRole('listitem')).toHaveLength(1)
    await user.click(within(section).getByText('Dentista'))
    await waitFor(() => expect(router.state.location.search).toBe('?vista=DAY&actividad=a5&dia=2026-10-14'))
    expect(await screen.findByRole('heading', { name: 'Editar actividad' })).toBeInTheDocument()
  })
})
