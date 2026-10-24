import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Report } from './api'

const text = (element: HTMLElement) => element.textContent?.replace(/\s/g, ' ')

const emptyReport: Report = {
  period: 'WEEK',
  start: '2026-10-19',
  end: '2026-10-25',
  to: '2026-10-22',
  partial: true,
  previousFrom: '2026-10-12',
  previousTo: '2026-10-15',
  tasks: { completed: 0, previousCompleted: 0 },
  finance: {
    currency: null,
    incomeCents: 0,
    expenseCents: 0,
    previousIncomeCents: 0,
    previousExpenseCents: 0,
    topExpenses: [],
  },
  training: { workouts: 0, previousWorkouts: 0, setsDone: 0, previousSetsDone: 0 },
  nutrition: { loggedDays: 0, previousLoggedDays: 0, averageCalories: null, previousAverageCalories: null, estimated: false },
  habits: [],
  body: [],
}

const fullReport: Report = {
  ...emptyReport,
  tasks: { completed: 3, previousCompleted: 1 },
  finance: {
    currency: 'EUR',
    incomeCents: 100000,
    expenseCents: 5000,
    previousIncomeCents: 0,
    previousExpenseCents: 4000,
    topExpenses: [{ id: 'c1', name: 'Comida', color: '#0f766e', amountCents: 3500 }],
  },
  training: { workouts: 1, previousWorkouts: 1, setsDone: 2, previousSetsDone: 1 },
  nutrition: { loggedDays: 2, previousLoggedDays: 1, averageCalories: 1200, previousAverageCalories: 1800, estimated: true },
  habits: [
    { id: 'h1', name: 'Leer', color: '#0f766e', frequency: 'DAILY', timesPerWeek: null, done: 3, expected: 4, previousDone: 1, previousExpected: 4 },
    { id: 'h2', name: 'Llamar a casa', color: '#7c3aed', frequency: 'WEEKLY', timesPerWeek: 2, done: 1, expected: null, previousDone: 0, previousExpected: null },
  ],
  body: [
    { metric: 'weightKg', firstDate: '2026-10-19', first: 80.5, lastDate: '2026-10-22', last: 80.1, count: 2 },
    { metric: 'waistCm', firstDate: '2026-10-19', first: 90, lastDate: '2026-10-19', last: 90, count: 1 },
  ],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('informes', () => {
  it('muestra cada cifra junto a la del periodo anterior sin valorarla', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/reports?period=WEEK&date=2026-10-22': () => json(fullReport),
    })
    renderApp('/informes')

    expect(await screen.findByRole('heading', { name: '19–25 oct 2026' })).toBeInTheDocument()
    expect(screen.getByText(/Periodo en curso: datos hasta el 22 oct 2026, junto a los mismos días del periodo anterior \(12–15 oct 2026\)/)).toBeInTheDocument()

    const activity = screen.getByRole('heading', { name: 'Actividad' }).closest('section')!
    expect(text(activity)).toContain('Tareas hechas3Antes: 1')
    expect(text(activity)).toContain('Series hechas2Antes: 1')

    const finance = screen.getByRole('heading', { name: 'Finanzas' }).closest('section')!
    expect(text(within(finance).getByText('Gastos').closest('div')!)).toBe('Gastos50,00 €Antes: 40,00 €')
    expect(within(finance).getByText('Comida')).toBeInTheDocument()

    const nutrition = screen.getByRole('heading', { name: 'Alimentación' }).closest('section')!
    expect(text(nutrition)).toContain('1200 kcalAntes: 1800 kcal')
    expect(within(nutrition).getByText('Incluye calorías estimadas.')).toBeInTheDocument()

    const habits = screen.getByRole('heading', { name: 'Hábitos' }).closest('section')!
    const rows = within(habits).getAllByRole('listitem').map(text)
    expect(rows).toEqual(['Leer3 de 4 días · 75 %Antes: 25 %', 'Llamar a casa1 vez · objetivo 2 por semanaAntes: 0 veces'])

    const body = screen.getByRole('heading', { name: 'Medidas' }).closest('section')!
    expect(within(body).getAllByRole('listitem').map(text)).toEqual([
      'Peso80,5 kg → 80,1 kg-0,4 kg entre el 19 oct 2026 y el 22 oct 2026',
      'Cintura90 cm19 oct 2026',
    ])
  })

  it('usa estados vacíos cuando no hay datos y navega entre periodos', async () => {
    const requests: string[] = []
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/reports?period=WEEK&date=2026-10-22': () => json(emptyReport),
      'GET /api/reports?period=WEEK&date=2026-10-18': () => {
        requests.push('previous week')
        return json({
          ...emptyReport,
          start: '2026-10-12',
          end: '2026-10-18',
          to: '2026-10-18',
          partial: false,
          previousFrom: '2026-10-05',
          previousTo: '2026-10-11',
        })
      },
      'GET /api/reports?period=MONTH&date=2026-10-18': () => {
        requests.push('month')
        return json({ ...emptyReport, period: 'MONTH', start: '2026-10-01', end: '2026-10-31', previousFrom: '2026-09-01', previousTo: '2026-09-18' })
      },
    })
    renderApp('/informes')
    const user = userEvent.setup()

    expect(await screen.findByText('Sin movimientos en este periodo ni en el anterior.')).toBeInTheDocument()
    expect(screen.getByText('Sin comidas anotadas en este periodo ni en el anterior.')).toBeInTheDocument()
    expect(screen.getByText('Sin medidas registradas en este periodo.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a hábitos' })).toHaveAttribute('href', '/habitos')
    // No se puede ir a una semana que aún no ha empezado
    expect(screen.getByRole('button', { name: 'Semana siguiente' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Semana anterior' }))
    expect(await screen.findByRole('heading', { name: '12–18 oct 2026' })).toBeInTheDocument()
    expect(screen.getByText('Junto a cada cifra, la del periodo anterior (5–11 oct 2026).')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Semana siguiente' })).toBeEnabled()

    await user.click(screen.getByRole('radio', { name: 'Mes' }))
    expect(await screen.findByRole('heading', { name: 'Octubre de 2026' })).toBeInTheDocument()
    expect(requests).toEqual(['previous week', 'month'])
  })

  it('se abre desde Hoy en el móvil', async () => {
    mockFetch({ 'GET /api/auth/me': () => json(testUser) })
    renderApp('/')
    // Un enlace en la cabecera para el móvil y otro en la navegación del escritorio
    const links = await screen.findAllByRole('link', { name: 'Informes' })
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/informes', '/informes'])
  })
})
