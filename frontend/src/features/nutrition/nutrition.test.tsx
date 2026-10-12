import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Food, NutritionDay, SavedMeal, Totals } from './api'

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
  name: 'Avena',
  quantity: null,
  unit: null,
  calories: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  estimated: false,
  ...overrides,
})
const noTarget = { calories: null, proteinG: null, carbsG: null, fatG: null, waterMl: null }

// Lunes 12 de octubre de 2026
const day: NutritionDay = {
  date: '2026-10-12',
  waterMl: 1500,
  meals: [
    {
      meal: 'BREAKFAST',
      note: null,
      entries: [
        {
          id: 'f1',
          date: '2026-10-12',
          meal: 'BREAKFAST',
          food: food({ quantity: 60, unit: 'g', calories: 230, proteinG: 8.1, carbsG: 39, fatG: 4.2 }),
        },
      ],
      totals: { ...noTotals, calories: 230, proteinG: 8.1, carbsG: 39, fatG: 4.2, entries: 1 },
    },
    {
      meal: 'LUNCH',
      note: 'Con prisa',
      entries: [
        { id: 'f2', date: '2026-10-12', meal: 'LUNCH', food: food({ name: 'Lentejas', calories: 450, estimated: true }) },
        { id: 'f3', date: '2026-10-12', meal: 'LUNCH', food: food({ name: 'Manzana' }) },
      ],
      totals: { ...noTotals, calories: 450, entries: 2, withoutCalories: 1, estimated: true, estimatedFields: ['calories'] },
    },
    { meal: 'DINNER', note: null, entries: [], totals: noTotals },
    { meal: 'SNACK', note: null, entries: [], totals: noTotals },
  ],
  totals: {
    calories: 680,
    proteinG: 8.1,
    carbsG: 39,
    fatG: 4.2,
    entries: 3,
    withoutCalories: 1,
    estimated: true,
    estimatedFields: ['calories'],
  },
  target: { ...noTarget, calories: 2200, waterMl: 2000 },
}

const week = {
  days: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].map((date, i) => ({
    date,
    totals: i === 0 ? day.totals : noTotals,
    waterMl: i === 0 ? 1500 : 0,
  })),
  target: day.target,
}

const savedMeal: SavedMeal = {
  id: 's1',
  name: 'Desayuno de diario',
  meal: 'BREAKFAST',
  items: [food({ name: 'Café', calories: 60, estimated: true }), food({ name: 'Tostada', calories: 220 })],
  totals: { ...noTotals, calories: 280, entries: 2, estimated: true, estimatedFields: ['calories'] },
}

const base = {
  'GET /api/auth/me': () => json(testUser),
  'GET /api/fitness/measurements': () => json([]),
  'GET /api/nutrition/days/2026-10-12': () => json(day),
  'GET /api/nutrition/summary?from=2026-10-12&to=2026-10-18': () => json(week),
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

describe('diario de alimentación', () => {
  it('muestra el día por comidas, marca lo estimado y suma solo lo anotado', async () => {
    let water: unknown = null
    mockFetch({
      ...base,
      'PUT /api/nutrition/days/2026-10-12/water': (init) => {
        water = body(init)
        return json({ ...day, waterMl: 1750 })
      },
    })
    renderApp('/entreno?vista=FOOD')
    const user = userEvent.setup()

    const totals = (await screen.findByRole('heading', { name: 'Total del día' })).closest('section')!
    expect(totals).toHaveTextContent('Calorías≈ 680 kcalde 2200 kcal')
    // Solo las calorías incluyen valores estimados
    expect(totals).toHaveTextContent('Proteínas8,1 g')
    expect(totals).toHaveTextContent('1 alimento sin calorías no suma. Incluye valores estimados (≈).')
    expect(totals).toHaveTextContent('1500 de 2000 ml')

    const breakfast = screen.getByRole('heading', { name: 'Desayuno' }).closest('section')!
    expect(breakfast).toHaveTextContent('Avena60 g · 230 kcal · P 8,1 · H 39 · G 4,2')
    const lunch = screen.getByRole('heading', { name: 'Comida' }).closest('section')!
    expect(within(lunch).getByText('Lentejas').closest('button')).toHaveTextContent('450 kcal≈ estimado')
    expect(within(lunch).getByLabelText('Notas de Comida')).toHaveValue('Con prisa')
    expect(screen.getByRole('heading', { name: 'Cena' }).closest('section')).toHaveTextContent('Nada anotado.')

    const summary = screen.getByRole('heading', { name: 'Resumen de la semana' }).closest('section')!
    expect(summary).toHaveTextContent('1 día con registros')
    expect(summary).toHaveTextContent('Media de calorías: 680 kcal')
    // No se puede ir a días futuros
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Añadir 250 ml de agua' }))
    await waitFor(() => expect(water).toEqual({ waterMl: 1750 }))
  })

  it('añade un alimento con solo lo que se sabe y marca los valores estimados', async () => {
    let saved: unknown = null
    mockFetch({
      ...base,
      'POST /api/nutrition/entries': (init) => {
        saved = body(init)
        return json({}, 201)
      },
    })
    renderApp('/entreno?vista=FOOD')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Añadir a Cena' }))
    const sheet = within(await screen.findByRole('dialog'))
    await user.type(sheet.getByLabelText('Alimento'), 'Tortilla de patatas')
    const estimated = sheet.getByRole('checkbox', { name: /Son valores estimados/ })
    // Sin nutrientes no hay nada que estimar
    expect(estimated).toBeDisabled()
    await user.type(sheet.getByLabelText('Cantidad'), '1,5')
    await user.type(sheet.getByLabelText('Unidad'), 'raciones')
    await user.type(sheet.getByLabelText('Calorías (kcal)'), 'mucho')
    await user.click(sheet.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Escribe un número válido')).toBeInTheDocument()
    expect(saved).toBeNull()

    await user.clear(sheet.getByLabelText('Calorías (kcal)'))
    await user.type(sheet.getByLabelText('Calorías (kcal)'), '350')
    await user.type(sheet.getByLabelText('Proteínas (g)'), '12,5')
    await user.click(estimated)
    await user.click(sheet.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(saved).toEqual({
        date: '2026-10-12',
        meal: 'DINNER',
        food: {
          name: 'Tortilla de patatas',
          quantity: 1.5,
          unit: 'raciones',
          calories: 350,
          proteinG: 12.5,
          carbsG: null,
          fatG: null,
          estimated: true,
        },
      }),
    )
  })

  it('añade una comida habitual a la comida elegida', async () => {
    let logged: unknown = null
    mockFetch({
      ...base,
      'GET /api/nutrition/saved-meals': () => json([savedMeal]),
      'POST /api/nutrition/saved-meals/s1/log': (init) => {
        logged = body(init)
        return json(day)
      },
    })
    renderApp('/entreno?vista=FOOD')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Añadir una comida habitual a Tentempiés' }))
    const option = await screen.findByRole('button', { name: /^Desayuno de diario/ })
    expect(option).toHaveTextContent('2 alimentos · ≈ 280 kcal')
    await user.click(option)
    await waitFor(() => expect(logged).toEqual({ date: '2026-10-12', meal: 'SNACK' }))
    expect(await screen.findByText('Añadida «Desayuno de diario»')).toBeInTheDocument()
  })

  it('guarda objetivos opcionales y avisa si las calorías son muy bajas', async () => {
    let target: unknown = null
    mockFetch({
      ...base,
      'PUT /api/nutrition/targets': (init) => {
        target = body(init)
        return json(target)
      },
    })
    renderApp('/entreno?vista=FOOD')
    const user = userEvent.setup()

    const form = (await screen.findByRole('heading', { name: 'Objetivos diarios' })).closest('section')!
    expect(form).toHaveTextContent('no sustituye el consejo de un profesional sanitario')
    const calories = within(form).getByLabelText('Calorías (kcal)')
    expect(calories).toHaveValue('2200')
    await user.clear(calories)
    await user.type(calories, '1000')
    expect(within(form).getByRole('status')).toHaveTextContent('puede no ser seguro')
    await user.type(within(form).getByLabelText('Proteínas (g)'), '110')
    await user.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(target).toEqual({ calories: 1000, proteinG: 110, carbsG: null, fatG: null, waterMl: 2000 }),
    )
  })
})
