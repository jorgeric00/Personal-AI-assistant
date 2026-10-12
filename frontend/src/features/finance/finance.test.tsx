import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { FinanceCategory, Movement, MovementPage } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}

const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))
const text = (element: HTMLElement) => element.textContent?.replace(/\s/g, ' ')

const groceries: FinanceCategory = { id: 'cat-1', kind: 'EXPENSE', name: 'Supermercado', color: '#16a34a', archived: false }
const transport: FinanceCategory = { id: 'cat-2', kind: 'EXPENSE', name: 'Transporte', color: '#0891b2', archived: false }
const salary: FinanceCategory = { id: 'cat-3', kind: 'INCOME', name: 'Nómina', color: '#16a34a', archived: false }
const old: FinanceCategory = { id: 'cat-4', kind: 'EXPENSE', name: 'Antigua', color: '#64748b', archived: true }
const categories = [groceries, transport, salary, old]

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'mov-1',
    kind: 'EXPENSE',
    amountCents: 4510,
    currency: 'EUR',
    date: '2026-10-11',
    category: groceries,
    account: null,
    description: 'Mercadona',
    tags: [],
    recurringId: null,
    createdAt: '2026-10-11T10:00:00Z',
    updatedAt: '2026-10-11T10:00:00Z',
    ...overrides,
  }
}

function page(items: Movement[], totals = { incomeCents: 0, expenseCents: 0, balanceCents: 0 }): MovementPage {
  return { items, page: 0, size: 50, totalItems: items.length, totals, currency: 'EUR' }
}

const summary = {
  month: '2026-10',
  currency: 'EUR',
  totals: { incomeCents: 250000, expenseCents: 60010, balanceCents: 189990 },
  previousMonth: '2026-09',
  previousTotals: { incomeCents: 250000, expenseCents: 50000, balanceCents: 200000 },
  byCategory: [
    { categoryId: 'cat-1', name: 'Supermercado', color: '#16a34a', kind: 'EXPENSE', amountCents: 45010 },
    { categoryId: 'cat-2', name: 'Transporte', color: '#0891b2', kind: 'EXPENSE', amountCents: 15000 },
    { categoryId: 'cat-3', name: 'Nómina', color: '#16a34a', kind: 'INCOME', amountCents: 250000 },
  ],
}

const trend = {
  currency: 'EUR',
  points: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((month, i) => ({
    month,
    incomeCents: 250000,
    expenseCents: 50000 + i * 1000,
    balanceCents: 200000 - i * 1000,
    savingsCents: (i + 1) * 190000,
  })),
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('finanzas', () => {
  it('muestra el resumen del mes con la comparación y los gastos por categoría', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/summary?month=2026-10': () => json(summary),
      'GET /api/finance/trend?to=2026-10&months=6': () => json(trend),
    })
    renderApp('/finanzas')

    expect(await screen.findByRole('heading', { name: 'Octubre de 2026' })).toBeInTheDocument()
    expect(await screen.findAllByText('2500,00 €', { normalizer: (s) => s.replace(/\s/g, ' ') })).not.toHaveLength(0)
    expect(screen.getAllByText('+1899,90 €', { normalizer: (s) => s.replace(/\s/g, ' ') })).not.toHaveLength(0)
    expect(screen.getByText(/Has gastado 100,10 €\s+más que en septiembre de 2026/)).toBeInTheDocument()

    const byCategory = screen.getByRole('heading', { name: 'Gastos por categoría' }).closest('section')!
    const rows = within(byCategory).getAllByRole('button')
    expect(rows.map((row) => row.textContent?.split(/\d/)[0])).toEqual(['Supermercado', 'Transporte'])
    expect(within(byCategory).getByText(/75 %/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Ingresos y gastos por mes' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Evolución del ahorro acumulado' })).toBeInTheDocument()
  })

  it('abre el historial filtrado al tocar una categoría', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/summary?month=2026-10': () => json(summary),
      'GET /api/finance/trend?to=2026-10&months=6': () => json(trend),
      'GET /api/finance/categories': () => json(categories),
      'GET /api/finance/movements?from=2026-10-01&to=2026-10-31&kind=EXPENSE&categoryId=cat-1&page=0&size=50': () =>
        json(page([movement({})], { incomeCents: 0, expenseCents: 4510, balanceCents: -4510 })),
    })
    const { router } = renderApp('/finanzas')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Supermercado/ }))
    expect(await screen.findByText('Mercadona')).toBeInTheDocument()
    expect(router.state.location.search).toContain('categoria=cat-1')
    expect(screen.getByRole('combobox', { name: 'Categoría' })).toHaveValue('cat-1')
  })

  it('registra un gasto con un importe escrito con coma y sin decimales flotantes', async () => {
    let created: unknown = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/summary?month=2026-10': () => json(summary),
      'GET /api/finance/trend?to=2026-10&months=6': () => json(trend),
      'GET /api/finance/categories': () => json(categories),
      'GET /api/finance/accounts': () => json([{ id: 'acc-1', name: 'Tarjeta' }]),
      'GET /api/finance/tags': () => json([]),
      'GET /api/auth/csrf': csrf,
      'POST /api/finance/movements': (init) => {
        created = body(init)
        return json(movement({ id: 'new' }), 201)
      },
    })
    renderApp('/finanzas?nuevo=EXPENSE')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Nuevo gasto' })
    // Las categorías archivadas y las de ingresos no se ofrecen para un gasto nuevo
    const categoryGroup = within(dialog).getByRole('radiogroup', { name: 'Categoría' })
    expect((await within(categoryGroup).findAllByRole('radio')).map((r) => r.textContent)).toEqual(['Supermercado', 'Transporte'])

    await user.type(within(dialog).getByLabelText('Importe'), '0,1')
    await user.click(within(dialog).getByRole('radio', { name: 'Transporte' }))
    await user.type(within(dialog).getByLabelText('Descripción'), 'Billete de bus')
    await user.selectOptions(within(dialog).getByLabelText('Cuenta o método de pago'), 'acc-1')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(created).toEqual({
        kind: 'EXPENSE',
        amountCents: 10,
        date: '2026-10-11',
        categoryId: 'cat-2',
        accountId: 'acc-1',
        description: 'Billete de bus',
        tags: [],
      }),
    )
  })

  it('no envía un importe no válido', async () => {
    const fetchMock = mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/summary?month=2026-10': () => json(summary),
      'GET /api/finance/trend?to=2026-10&months=6': () => json(trend),
      'GET /api/finance/categories': () => json(categories),
      'GET /api/finance/accounts': () => json([]),
      'GET /api/finance/tags': () => json([]),
    })
    renderApp('/finanzas?nuevo=INCOME')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Nuevo ingreso' })
    await user.type(within(dialog).getByLabelText('Importe'), 'doce')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await within(dialog).findByText(/Escribe un importe mayor que cero/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('lista los movimientos agrupados por día con sus totales y carga más', async () => {
    const first = Array.from({ length: 50 }, (_, i) => movement({ id: `m${i}`, description: `Compra ${i}`, date: i < 2 ? '2026-10-11' : '2026-10-10' }))
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/categories': () => json(categories),
      'GET /api/finance/movements?page=0&size=50': () =>
        json({ ...page(first, { incomeCents: 0, expenseCents: 230010, balanceCents: -230010 }), totalItems: 51 }),
      'GET /api/finance/movements?page=1&size=50': () =>
        json({ ...page([movement({ id: 'last', description: 'La última', date: '2026-10-01' })]), page: 1, totalItems: 51 }),
    })
    renderApp('/finanzas?vista=MOVEMENTS')
    const user = userEvent.setup()

    expect(await screen.findByRole('region', { name: 'Hoy' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ayer' })).toBeInTheDocument()
    expect(text(screen.getByLabelText('Totales de lo filtrado'))).toContain('-2300,10 €')
    await user.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('La última')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull()
  })

  it('muestra el balance del mes y el acceso rápido en Hoy', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/summary?month=2026-10': () => json(summary),
    })
    renderApp('/')

    const section = await screen.findByRole('region', { name: 'Este mes' })
    await waitFor(() => expect(text(section)).toContain('+1899,90 €'))
    expect(screen.getByRole('link', { name: 'Gasto' })).toHaveAttribute('href', '/finanzas?nuevo=EXPENSE')
  })

  it('muestra los presupuestos con su nivel de aviso en el resumen y permite añadir uno', async () => {
    let saved: unknown = null
    const leisure: FinanceCategory = { id: 'cat-5', kind: 'EXPENSE', name: 'Ocio', color: '#db2777', archived: false }
    const budget = (id: string, category: FinanceCategory, amountCents: number, spentCents: number, level: string) => ({
      id,
      category,
      amountCents,
      spentCents,
      currency: 'EUR',
      level,
    })
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/summary?month=2026-10': () => json(summary),
      'GET /api/finance/trend?to=2026-10&months=6': () => json(trend),
      'GET /api/finance/budgets?month=2026-10': () =>
        json([budget('b1', groceries, 50000, 45010, 'WARNING'), budget('b2', transport, 10000, 15000, 'EXCEEDED')]),
      'GET /api/finance/categories': () => json([...categories, leisure]),
      'GET /api/finance/recurring': () => json([]),
      'GET /api/auth/csrf': csrf,
      'PUT /api/finance/budgets': (init) => {
        saved = body(init)
        return json(budget('b3', leisure, 2000, 0, 'OK'))
      },
    })
    renderApp('/finanzas')
    const user = userEvent.setup()

    expect(
      await screen.findByText('Casi has agotado el presupuesto de Supermercado. Has superado el presupuesto de Transporte.'),
    ).toBeInTheDocument()
    const summaryBudgets = screen.getByRole('heading', { name: 'Presupuestos del mes' }).closest('section')!
    expect(within(summaryBudgets).getByRole('progressbar', { name: 'Transporte' })).toHaveAttribute('aria-valuenow', '100')
    expect(text(summaryBudgets)).toContain('te has pasado 50,00 €')
    expect(text(summaryBudgets)).toContain('quedan 49,90 €')

    await user.click(within(summaryBudgets).getByRole('button', { name: 'Gestionar' }))
    expect(await screen.findByText('No tienes movimientos recurrentes.')).toBeInTheDocument()
    const budgets = screen.getByRole('heading', { name: 'Presupuestos del mes' }).closest('section')!
    await user.click(within(budgets).getByRole('button', { name: 'Añadir' }))
    // Solo se ofrecen categorías de gasto activas que aún no tienen presupuesto
    const select = within(budgets).getByLabelText('Categoría')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Elige una categoría', 'Ocio'])
    await user.selectOptions(select, 'cat-5')
    await user.type(within(budgets).getByLabelText('Límite mensual'), '20')
    await user.click(within(budgets).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(saved).toEqual({ categoryId: 'cat-5', amountCents: 2000 }))
  })

  it('crea un movimiento recurrente desde el formulario con «Repetir»', async () => {
    let created: unknown = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/categories': () => json(categories),
      'GET /api/finance/accounts': () => json([]),
      'GET /api/finance/tags': () => json([]),
      'GET /api/finance/recurring': () => json([]),
      'GET /api/auth/csrf': csrf,
      'POST /api/finance/recurring': (init) => {
        created = body(init)
        return json({ id: 'r1' }, 201)
      },
    })
    renderApp('/finanzas?vista=BUDGETS')
    const user = userEvent.setup()

    const recurring = (await screen.findByRole('heading', { name: 'Movimientos recurrentes' })).closest('section')!
    await user.click(within(recurring).getByRole('button', { name: 'Añadir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo gasto' })
    expect(within(dialog).getByLabelText('Repetir')).toHaveValue('MONTHLY')
    // Las etiquetas no se aplican a los recurrentes
    expect(within(dialog).queryByLabelText('Etiquetas')).toBeNull()

    await user.type(within(dialog).getByLabelText('Importe'), '650')
    await user.click(await within(dialog).findByRole('radio', { name: 'Transporte' }))
    await user.type(within(dialog).getByLabelText('Descripción'), 'Abono')
    await user.clear(within(dialog).getByLabelText('Primera fecha'))
    await user.type(within(dialog).getByLabelText('Primera fecha'), '2026-10-01')
    await user.clear(within(dialog).getByLabelText('Cada cuántos (1–12)'))
    await user.type(within(dialog).getByLabelText('Cada cuántos (1–12)'), '40')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(created).toEqual({
        kind: 'EXPENSE',
        amountCents: 65000,
        categoryId: 'cat-2',
        accountId: null,
        description: 'Abono',
        frequency: 'MONTHLY',
        every: 12,
        startDate: '2026-10-01',
        untilDate: null,
      }),
    )
  })

  it('lista los recurrentes y permite detenerlos; marca los movimientos generados', async () => {
    let stopped = false
    const rule = {
      id: 'r1',
      kind: 'INCOME',
      amountCents: 250000,
      currency: 'EUR',
      category: salary,
      account: null,
      description: 'Nómina',
      frequency: 'MONTHLY',
      every: 1,
      startDate: '2026-01-28',
      untilDate: null,
      nextDate: '2026-10-28',
    }
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/categories': () => json(categories),
      'GET /api/finance/recurring': () => json(stopped ? [{ ...rule, nextDate: null }] : [rule]),
      'GET /api/auth/csrf': csrf,
      'POST /api/finance/recurring/r1/stop': () => {
        stopped = true
        return json({ ...rule, nextDate: null })
      },
      'GET /api/finance/movements?page=0&size=50': () =>
        json(page([movement({ id: 'g1', kind: 'INCOME', category: salary, description: 'Nómina', recurringId: 'r1' })])),
    })
    const { router } = renderApp('/finanzas?vista=BUDGETS')
    const user = userEvent.setup()

    const recurring = (await screen.findByRole('heading', { name: 'Movimientos recurrentes' })).closest('section')!
    await waitFor(() => expect(text(recurring)).toContain('Cada mes · próximo: mié, 28 oct'))
    expect(text(recurring)).toContain('+2500,00 €')
    await user.click(within(recurring).getByRole('button', { name: 'Detener' }))
    await waitFor(() => expect(text(recurring)).toContain('terminado'))
    expect(within(recurring).queryByRole('button', { name: 'Detener' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Movimientos' }))
    expect(router.state.location.search).toContain('vista=MOVEMENTS')
    expect(await screen.findByText('Recurrente:')).toBeInTheDocument()
  })

  it('exporta con las fechas filtradas e informa de los errores al importar un CSV', async () => {
    let uploaded: FormData | null = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/finance/categories': () => json(categories),
      'GET /api/finance/movements?from=2026-10-01&to=2026-10-31&page=0&size=50': () => json(page([])),
      'GET /api/auth/csrf': csrf,
      'POST /api/finance/import': (init) => {
        uploaded = init?.body as FormData
        return json({
          imported: 0,
          skippedDuplicates: 0,
          createdCategories: [],
          createdAccounts: [],
          errors: [{ line: 3, message: 'Importe no válido: «abc»' }],
        })
      },
    })
    renderApp('/finanzas?vista=MOVEMENTS&desde=2026-10-01&hasta=2026-10-31')
    const user = userEvent.setup()

    const link = await screen.findByRole('link', { name: 'Exportar CSV de estas fechas' })
    expect(link).toHaveAttribute('href', '/api/finance/export?from=2026-10-01&to=2026-10-31')

    const file = new File(['fecha;tipo;importe;categoría\n'], 'banco.csv', { type: 'text/csv' })
    await user.upload(screen.getByTestId('csv-file'), file)
    const alert = await screen.findByRole('alert')
    expect(text(alert)).toContain('No se ha importado nada: hay 1 error que corregir.')
    expect(text(alert)).toContain('Línea 3: Importe no válido: «abc»')
    expect((uploaded as FormData | null)?.get('file')).toBeInstanceOf(File)
  })
})
