import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { CustomMetric, Measurement } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}
const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

const entry = (overrides: Partial<Measurement>): Measurement => ({
  id: 'm1',
  date: '2026-10-10',
  notes: null,
  custom: {},
  weightKg: null,
  bodyFatPct: null,
  waistCm: null,
  chestCm: null,
  hipCm: null,
  armCm: null,
  thighCm: null,
  ...overrides,
})

const pulse: CustomMetric = { id: 'c1', name: 'Pulso en reposo', unit: 'ppm', decimals: 0, archived: false }
const sleep: CustomMetric = { id: 'c2', name: 'Sueño', unit: 'h', decimals: 1, archived: true }

const base = {
  'GET /api/auth/me': () => json(testUser),
  'GET /api/auth/csrf': csrf,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('indicadores propios', () => {
  it('se ven en el último registro, el gráfico y el historial, también los archivados con valores', async () => {
    mockFetch({
      ...base,
      'GET /api/fitness/metrics': () => json([pulse, sleep]),
      'GET /api/fitness/measurements': () =>
        json([
          entry({ id: 'm2', date: '2026-10-10', custom: { c1: 56 } }),
          entry({ id: 'm1', date: '2026-09-01', weightKg: 82.4, custom: { c1: 61, c2: 7.5 } }),
        ]),
    })
    renderApp('/entreno?vista=PROGRESS')
    const user = userEvent.setup()

    const latest = (await screen.findByRole('heading', { name: 'Último registro' })).closest('section')!
    const tile = within(latest).getByText('Pulso en reposo').closest('li')!
    expect(tile).toHaveTextContent('56 ppm')
    expect(tile).toHaveTextContent('-5 ppm desde el 1 sept 2026')
    expect(within(latest).getByText('Sueño').closest('li')).toHaveTextContent('7,5 h')

    await user.click(screen.getByRole('radio', { name: 'Pulso en reposo' }))
    expect(screen.getByRole('img', { name: 'Evolución de Pulso en reposo' })).toBeInTheDocument()

    const history = screen.getByRole('heading', { name: 'Historial' }).closest('section')!
    expect(history).toHaveTextContent('Peso 82,4 kg · Pulso en reposo 61 ppm · Sueño 7,5 h')
  })

  it('se crean desde Progreso y se anotan en el registro con sus decimales', async () => {
    let metric: unknown = null
    let saved: unknown = null
    let metrics: CustomMetric[] = []
    mockFetch({
      ...base,
      'GET /api/fitness/metrics': () => json(metrics),
      'GET /api/fitness/measurements': () => json([entry({ weightKg: 80 })]),
      'POST /api/fitness/metrics': (init) => {
        metric = body(init)
        metrics = [pulse]
        return json(pulse, 201)
      },
      'POST /api/fitness/measurements': (init) => {
        saved = body(init)
        return json(entry({ id: 'm9', date: '2026-10-11' }), 201)
      },
    })
    renderApp('/entreno?vista=PROGRESS')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Indicadores propios' }))
    const sheet = await screen.findByRole('dialog', { name: 'Tus indicadores' })
    expect(within(sheet).getByText('Aún no has creado ninguno.')).toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Nombre'), 'Pulso en reposo')
    await user.type(within(sheet).getByLabelText('Unidad (opcional)'), 'ppm')
    await user.click(within(sheet).getByRole('button', { name: 'Añadir' }))
    await waitFor(() => expect(metric).toEqual({ name: 'Pulso en reposo', unit: 'ppm', decimals: 0, archived: false }))
    expect(await within(sheet).findByRole('button', { name: /^Pulso en reposo/ })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Cerrar' }))

    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    const editor = await screen.findByRole('dialog', { name: 'Nuevo registro' })
    await user.type(within(editor).getByLabelText('Pulso en reposo (ppm)'), '57,5')
    await user.click(within(editor).getByRole('button', { name: 'Guardar' }))
    expect(within(editor).getByText('Escribe un número entero, por ejemplo 58')).toBeInTheDocument()
    expect(saved).toBeNull()

    await user.clear(within(editor).getByLabelText('Pulso en reposo (ppm)'))
    await user.type(within(editor).getByLabelText('Pulso en reposo (ppm)'), '57')
    await user.click(within(editor).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(saved).toMatchObject({ date: '2026-10-11', weightKg: null, custom: { c1: 57 } }))
  })
})
