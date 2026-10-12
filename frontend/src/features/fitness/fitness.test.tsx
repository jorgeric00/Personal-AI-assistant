import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Measurement, Profile } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}
const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))
const text = (element: HTMLElement) => element.textContent?.replace(/\s/g, ' ')

function entry(overrides: Partial<Measurement>): Measurement {
  return {
    id: 'm1',
    date: '2026-10-10',
    weightKg: null,
    bodyFatPct: null,
    waistCm: null,
    chestCm: null,
    hipCm: null,
    armCm: null,
    thighCm: null,
    notes: null,
    ...overrides,
  }
}

// Del más reciente al más antiguo, como los devuelve el servidor
const entries = [
  entry({ id: 'm3', date: '2026-10-10', weightKg: 80.9, bodyFatPct: 21.5 }),
  entry({ id: 'm2', date: '2026-10-01', waistCm: 91.5, notes: 'Duermo mejor' }),
  entry({ id: 'm1', date: '2026-09-01', weightKg: 82.4, waistCm: 94 }),
]

const emptyProfile: Profile = {
  birthDate: null,
  age: null,
  heightCm: null,
  startWeightKg: null,
  currentWeightKg: null,
  currentWeightDate: null,
  goal: null,
  goalDetails: null,
  activityLevel: null,
  experience: null,
  daysPerWeek: null,
  minutesPerSession: null,
  foodPreferences: null,
  foodAvoid: null,
  equipment: null,
  notes: null,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('entreno', () => {
  it('muestra el último valor de cada medida con su cambio y el historial', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/measurements': () => json(entries),
    })
    renderApp('/entreno?vista=PROGRESS')
    const user = userEvent.setup()

    const latest = (await screen.findByRole('heading', { name: 'Último registro' })).closest('section')!
    const tiles = within(latest).getAllByRole('listitem').map(text)
    expect(tiles).toEqual([
      'Peso80,9 kg-1,5 kg desde el 1 sept 2026',
      'Grasa corporal21,5 %10 oct 2026',
      'Cintura91,5 cm-2,5 cm desde el 1 sept 2026',
    ])
    // Al comparar desde octubre, el peso se compara con el primer registro con peso desde esa fecha
    await user.selectOptions(within(latest).getByRole('combobox'), '2026-10-01')
    expect(text(within(latest).getAllByRole('listitem')[0])).toBe('Peso80,9 kg10 oct 2026')

    const chart = screen.getByRole('heading', { name: 'Evolución' }).closest('section')!
    expect(within(chart).getByRole('radio', { name: 'Peso' })).toHaveAttribute('aria-checked', 'true')
    expect(within(chart).getByRole('img', { name: 'Evolución de Peso' })).toBeInTheDocument()
    await user.click(within(chart).getByRole('radio', { name: 'Cintura' }))
    expect(within(chart).getByRole('img', { name: 'Evolución de Cintura' })).toBeInTheDocument()

    const history = screen.getByRole('heading', { name: 'Historial' }).closest('section')!
    const rows = within(history).getAllByRole('button').map(text)
    expect(rows[0]).toBe('10 oct 2026Peso 80,9 kg · Grasa 21,5 %')
    expect(rows[1]).toBe('1 oct 2026Cintura 91,5 cmDuermo mejor')
  })

  it('registra solo los valores escritos y, si el día ya tiene registro, lo edita', async () => {
    let created: unknown = null
    let updated: unknown = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/measurements': () => json(entries),
      'GET /api/auth/csrf': csrf,
      'POST /api/fitness/measurements': (init) => {
        created = body(init)
        return json(entry({ id: 'new' }), 201)
      },
      'PUT /api/fitness/measurements/m3': (init) => {
        updated = body(init)
        return json(entries[0])
      },
    })
    renderApp('/entreno?vista=PROGRESS&nuevo=1')
    const user = userEvent.setup()

    // Hoy no hay registro: se crea uno nuevo
    let dialog = await screen.findByRole('dialog', { name: 'Nuevo registro' })
    await user.type(within(dialog).getByLabelText('Peso (kg)'), '80,25')
    await user.type(within(dialog).getByLabelText('Cintura (cm)'), '90.5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(created).toEqual({
        date: '2026-10-11',
        weightKg: 80.25,
        bodyFatPct: null,
        waistCm: 90.5,
        chestCm: null,
        hipCm: null,
        armCm: null,
        thighCm: null,
        notes: null,
      }),
    )

    // Al elegir un día con registro se carga ese registro
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    dialog = await screen.findByRole('dialog', { name: 'Nuevo registro' })
    const date = within(dialog).getByLabelText('Fecha')
    await user.clear(date)
    await user.type(date, '2026-10-10')
    expect(await within(dialog).findByText('Ya tienes un registro ese día: lo estás editando.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Peso (kg)')).toHaveValue('80,9')
    await user.clear(within(dialog).getByLabelText('Peso (kg)'))
    await user.type(within(dialog).getByLabelText('Peso (kg)'), '81')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(updated).toMatchObject({ date: '2026-10-10', weightKg: 81, bodyFatPct: 21.5 }))
  })

  it('no envía números no válidos ni registros vacíos', async () => {
    const fetchMock = mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/measurements': () => json([]),
    })
    renderApp('/entreno?vista=PROGRESS')
    const user = userEvent.setup()

    expect(await screen.findByText(/Aún no hay registros/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Registrar' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo registro' })
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await within(dialog).findByText('Anota al menos un valor o un comentario.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Cintura (cm)'), '91,55')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await within(dialog).findByText(/con un decimal como mucho/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('guarda un perfil parcial sin asumir datos', async () => {
    let saved: Record<string, unknown> | null = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/measurements': () => json([]),
      'GET /api/fitness/profile': () => json(saved ? { ...emptyProfile, ...saved, age: 35, currentWeightKg: 82.4 } : emptyProfile),
      'GET /api/auth/csrf': csrf,
      'PUT /api/fitness/profile': (init) => {
        saved = body(init)
        return json({ ...emptyProfile, ...saved, age: 35, currentWeightKg: 82.4 })
      },
    })
    renderApp('/entreno?vista=PROFILE')
    const user = userEvent.setup()

    const goal = await screen.findByLabelText('Objetivo principal')
    expect(goal).toHaveValue('')
    expect(screen.queryByText('Edad')).toBeNull()
    await user.selectOptions(goal, 'LOSE_FAT')
    await user.type(screen.getByLabelText('Altura (cm)'), '178,5')
    await user.type(screen.getByLabelText('Peso inicial (kg)'), '82,4')
    await user.selectOptions(screen.getByLabelText('Días por semana'), '3')
    await user.type(screen.getByLabelText('Equipamiento disponible'), '  Mancuernas  ')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(saved).toEqual({
        ...Object.fromEntries(Object.keys(emptyProfile).filter((k) => !['age', 'currentWeightKg', 'currentWeightDate'].includes(k)).map((k) => [k, null])),
        goal: 'LOSE_FAT',
        heightCm: 178.5,
        startWeightKg: 82.4,
        daysPerWeek: 3,
        equipment: 'Mancuernas',
      }),
    )
    expect(await screen.findByText('35 años')).toBeInTheDocument()
    expect(screen.getByText('Peso inicial')).toBeInTheDocument()
  })

  it('ofrece el acceso rápido desde Hoy', async () => {
    mockFetch({ 'GET /api/auth/me': () => json(testUser) })
    renderApp('/')
    expect(await screen.findByRole('link', { name: 'Peso o medidas' })).toHaveAttribute('href', '/entreno?vista=PROGRESS&nuevo=1')
  })
})
