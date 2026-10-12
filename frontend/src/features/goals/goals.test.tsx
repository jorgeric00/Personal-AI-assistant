import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Measurement, WorkoutSummary } from '../fitness/api'
import type { Goal } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}
const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

const goal = (overrides: Partial<Goal>): Goal => ({
  id: 'g1',
  title: 'Entrenar más',
  kind: 'TRAINING',
  metric: null,
  targetValue: 3,
  exerciseId: null,
  habitId: null,
  startDate: '2026-09-01',
  targetDate: '2026-12-31',
  notes: null,
  status: 'ACTIVE',
  achievedOn: null,
  ...overrides,
})

const workout = (date: string, finished = true): WorkoutSummary => ({
  id: date,
  routineId: null,
  name: 'Fuerza',
  date,
  finished,
  finishedAt: null,
  exerciseCount: 3,
  doneSets: 9,
})

const measurement = (date: string, weightKg: number): Measurement => ({
  id: date,
  date,
  notes: null,
  weightKg,
  bodyFatPct: null,
  waistCm: null,
  chestCm: null,
  hipCm: null,
  armCm: null,
  thighCm: null,
})

const base = {
  'GET /api/auth/me': () => json(testUser),
  'GET /api/auth/csrf': csrf,
}

// Miércoles 14 de octubre de 2026
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('objetivos', () => {
  it('muestra el progreso real a partir de los registros', async () => {
    mockFetch({
      ...base,
      'GET /api/goals': () =>
        json([
          goal({}),
          goal({ id: 'g2', title: 'Bajar a 75 kg', kind: 'BODY', metric: 'WEIGHT_KG', targetValue: 75, targetDate: null }),
          goal({ id: 'g3', title: 'Correr 10 km', kind: 'CUSTOM', targetValue: null, status: 'ACHIEVED', achievedOn: '2026-10-01' }),
        ]),
      // Dos días esta semana (uno sin terminar no cuenta) y tres la semana pasada
      'GET /api/fitness/workouts': () =>
        json([
          workout('2026-10-14', false),
          workout('2026-10-13'),
          workout('2026-10-12'),
          workout('2026-10-09'),
          workout('2026-10-07'),
          workout('2026-10-05'),
        ]),
      'GET /api/fitness/measurements': () => json([measurement('2026-10-10', 78), measurement('2026-08-30', 80)]),
    })
    renderApp('/objetivos')

    const active = (await screen.findByRole('heading', { name: 'En marcha' })).closest('section')!
    const training = within(active).getByRole('button', { name: /^Entrenar más/ }).closest('li')!
    await waitFor(() => expect(training).toHaveTextContent('2 de 3 días entrenados esta semana'))
    expect(training).toHaveTextContent('cumplido 1 de las últimas 4 semanas')
    expect(within(training).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67')
    expect(training).toHaveTextContent('quedan 78 días')

    const body = within(active).getByRole('button', { name: /^Bajar a 75 kg/ }).closest('li')!
    await waitFor(() => expect(body).toHaveTextContent(/Peso: 78.* ahora, 80.* al empezar, meta 75/))
    expect(within(body).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
    expect(body).toHaveTextContent('Sin fecha límite')

    // Lo conseguido queda aparte
    expect(within(active).queryByText('Correr 10 km')).not.toBeInTheDocument()
    expect(screen.getByText('Conseguido (1)')).toBeInTheDocument()
  })

  it('un objetivo personal se da por conseguido a mano', async () => {
    let saved: unknown = null
    mockFetch({
      ...base,
      'GET /api/goals': () => json([goal({ kind: 'CUSTOM', title: 'Correr 10 km', targetValue: null })]),
      'PUT /api/goals/g1': (init) => {
        saved = body(init)
        return json(goal({ kind: 'CUSTOM', status: 'ACHIEVED', achievedOn: '2026-10-14' }))
      },
    })
    renderApp('/objetivos')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Marcar como conseguido' }))
    await waitFor(() => expect(saved).toMatchObject({ kind: 'CUSTOM', status: 'ACHIEVED' }))
  })

  it('crea un objetivo de medida corporal con aviso de prudencia', async () => {
    let saved: unknown = null
    mockFetch({
      ...base,
      'POST /api/goals': (init) => {
        saved = body(init)
        return json(goal({ id: 'g9' }), 201)
      },
    })
    renderApp('/objetivos?objetivo=nuevo')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Nuevo objetivo' })
    await user.type(within(dialog).getByLabelText('Qué quieres conseguir'), 'Bajar de peso')
    expect(within(dialog).getByText(/consulta con un profesional sanitario/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(dialog).getByText('Indica una meta válida.')).toBeInTheDocument()
    expect(saved).toBeNull()

    await user.type(within(dialog).getByLabelText('Meta (kg)'), '74,5')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(saved).toEqual({
        title: 'Bajar de peso',
        kind: 'BODY',
        metric: 'WEIGHT_KG',
        targetValue: 74.5,
        exerciseId: null,
        habitId: null,
        targetDate: null,
        notes: null,
        status: 'ACTIVE',
      }),
    )
  })

  it('en Hoy invita a crear un objetivo si no hay ninguno', async () => {
    mockFetch(base)
    renderApp('/')

    const section = (await screen.findByRole('heading', { name: 'Objetivos' })).closest('section')!
    expect(within(section).getByText('Sin objetivos activos.')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'Crear un objetivo' })).toHaveAttribute(
      'href',
      '/objetivos?objetivo=nuevo',
    )
  })
})
