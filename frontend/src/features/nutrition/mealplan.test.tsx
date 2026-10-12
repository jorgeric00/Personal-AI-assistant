import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Food, NutritionDay, PlannedMeal, SavedMeal, Totals } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}
const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

const noTotals: Totals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  entries: 0,
  withoutCalories: 0,
  estimated: false,
  estimatedFields: [],
}
const food = (overrides: Partial<Food>): Food => ({
  name: 'Pollo',
  quantity: null,
  unit: null,
  calories: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  estimated: false,
  ...overrides,
})

const chicken: SavedMeal = {
  id: 's2',
  name: 'Pollo con arroz',
  meal: 'LUNCH',
  items: [
    food({ name: 'Pollo', quantity: 150, unit: 'g', calories: 250 }),
    food({ name: 'Arroz', quantity: 80, unit: 'g', calories: 290, estimated: true }),
  ],
  totals: { ...noTotals, calories: 540, entries: 2, estimated: true, estimatedFields: ['calories'] },
}

const planned = (overrides: Partial<PlannedMeal>): PlannedMeal => ({
  id: 'p1',
  date: '2026-10-13',
  meal: 'LUNCH',
  title: 'Pollo con arroz',
  savedMealId: 's2',
  notes: null,
  prepDate: null,
  prepared: false,
  logged: false,
  ...overrides,
})

// Lunes 12 de octubre de 2026
const plans: PlannedMeal[] = [
  planned({ id: 'p0', date: '2026-10-12', meal: 'BREAKFAST', title: 'Tostadas', savedMealId: null, logged: true }),
  planned({ id: 'p1', prepDate: '2026-10-12' }),
  planned({ id: 'p3', date: '2026-10-14', meal: 'DINNER', title: 'Crema de verduras', savedMealId: null }),
  planned({ id: 'p2', date: '2026-10-15' }),
]

const emptyDay: NutritionDay = {
  date: '2026-10-12',
  waterMl: 0,
  meals: (['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const).map((meal) => ({ meal, note: null, entries: [], totals: noTotals })),
  totals: noTotals,
  target: { calories: 2200, proteinG: null, carbsG: null, fatG: null, waterMl: null },
}

const base = {
  'GET /api/auth/me': () => json(testUser),
  'GET /api/fitness/measurements': () => json([]),
  'GET /api/nutrition/days/2026-10-12': () => json(emptyDay),
  'GET /api/nutrition/saved-meals': () => json([chicken]),
  'GET /api/auth/csrf': csrf,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('plan semanal de comidas', () => {
  it('muestra la semana, lo que hay que preparar y la lista de la compra', async () => {
    let prepared: unknown = null
    mockFetch({
      ...base,
      'GET /api/nutrition/plan?from=2026-10-05&to=2026-10-18': () => json(plans),
      'PUT /api/nutrition/plan/p1/prepared': (init) => {
        prepared = body(init)
        return json({ ...plans[1], prepared: true })
      },
    })
    renderApp('/entreno?vista=FOOD&comidas=plan')
    const user = userEvent.setup()

    const tuesday = (await screen.findByRole('heading', { name: 'Mañana' })).closest('li')!
    expect(tuesday).toHaveTextContent('Pollo con arroz')
    expect(tuesday).toHaveTextContent('Preparar: Hoy')
    // Las calorías planificadas salen de la comida habitual y se marcan como estimadas
    expect(tuesday).toHaveTextContent('Planificado: ≈ 540 kcal · objetivo 2200 kcal')
    const today = screen.getByRole('heading', { name: /^Hoy/ }).closest('li')!
    expect(today).toHaveTextContent('Tostadas')
    expect(today).toHaveTextContent('en el diario')

    const shopping = screen.getByRole('heading', { name: 'Lista de la compra' }).closest('section')!
    const items = within(shopping)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(items).toEqual(['Arroz160 g', 'Pollo300 g'])
    expect(shopping).toHaveTextContent('Sin lista de alimentos: Crema de verduras.')

    const prep = screen.getByRole('heading', { name: 'Preparación' }).closest('section')!
    expect(prep).toHaveTextContent('Queda 1 por preparar.')
    await user.click(within(prep).getByRole('checkbox'))
    await waitFor(() => expect(prepared).toEqual({ prepared: true }))
  })

  it('planifica una comida habitual con preparación anticipada', async () => {
    let saved: unknown = null
    mockFetch({
      ...base,
      'POST /api/nutrition/plan': (init) => {
        saved = body(init)
        return json(planned({ id: 'p9', date: '2026-10-14' }), 201)
      },
    })
    const { router } = renderApp('/entreno?vista=FOOD&comidas=plan')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Planificar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Planificar comida' })
    await user.clear(within(dialog).getByLabelText('Día'))
    await user.type(within(dialog).getByLabelText('Día'), '2026-10-14')
    await user.selectOptions(within(dialog).getByLabelText('Comida habitual (opcional)'), 's2')
    expect(within(dialog).getByLabelText('Qué vas a comer')).toHaveValue('Pollo con arroz')
    // La preparación no puede ser después del día de la comida
    await user.type(within(dialog).getByLabelText('Preparar con antelación el día'), '2026-10-15')
    expect(within(dialog).getByText('Tiene que ser antes del día de la comida o ese mismo día')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await user.clear(within(dialog).getByLabelText('Preparar con antelación el día'))
    await user.type(within(dialog).getByLabelText('Preparar con antelación el día'), '2026-10-12')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(saved).toEqual({
        date: '2026-10-14',
        meal: 'LUNCH',
        title: 'Pollo con arroz',
        savedMealId: 's2',
        notes: null,
        prepDate: '2026-10-12',
      }),
    )
    await waitFor(() => expect(router.state.location.search).toBe('?vista=FOOD&comidas=plan'))
  })

  it('ofrece repetir la semana anterior si esta está vacía', async () => {
    let copied: unknown = null
    mockFetch({
      ...base,
      'GET /api/nutrition/plan?from=2026-10-05&to=2026-10-18': () =>
        json([planned({ id: 'old', date: '2026-10-06' }), planned({ id: 'old2', date: '2026-10-08' })]),
      'POST /api/nutrition/plan/copy-week': (init) => {
        copied = body(init)
        return json([])
      },
    })
    renderApp('/entreno?vista=FOOD&comidas=plan')
    const user = userEvent.setup()

    expect(await screen.findByText('No hay nada planificado esta semana.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Repetir la semana anterior (2 comidas)' }))
    await waitFor(() => expect(copied).toEqual({ from: '2026-10-05', to: '2026-10-12' }))
  })

  it('en el diario ofrece pasar lo planificado de ese día, sin darlo por comido', async () => {
    let logged = false
    mockFetch({
      ...base,
      'GET /api/nutrition/summary?from=2026-10-12&to=2026-10-18': () =>
        json({ days: [], target: emptyDay.target }),
      'GET /api/nutrition/plan?from=2026-10-12&to=2026-10-12': () =>
        json([planned({ id: 'p5', date: '2026-10-12', title: 'Lentejas', savedMealId: null })]),
      'POST /api/nutrition/plan/p5/log': () => {
        logged = true
        return json(planned({ id: 'p5', date: '2026-10-12', logged: true }))
      },
    })
    renderApp('/entreno?vista=FOOD')
    const user = userEvent.setup()

    const section = (await screen.findByRole('heading', { name: 'Planificado para este día' })).closest('section')!
    expect(section).toHaveTextContent('ComidaLentejas')
    // Planificar no suma: el total del día sigue vacío
    expect(screen.getByRole('heading', { name: 'Total del día' }).closest('section')).toHaveTextContent(
      'Aún no has anotado nada',
    )
    await user.click(within(section).getByRole('button', { name: 'Pasar «Lentejas» al diario' }))
    await waitFor(() => expect(logged).toBe(true))
  })
})
