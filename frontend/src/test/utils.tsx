import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'

import { routes } from '../app/router'
import { ToastProvider } from '../ui/Toast'

export function renderApp(initialPath = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { router, queryClient }
}

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

/** Respuestas por defecto para las lecturas que hacen muchas pantallas (listas vacías). */
const defaultHandlers: Record<string, Handler> = {
  'GET /api/tasks?view=TODAY': () => json([]),
  'GET /api/tasks?view=UPCOMING&kind=REMINDER': () => json([]),
  'GET /api/task-categories': () => json([]),
  'GET /api/tasks?view=ALL': () => json([]),
  'GET /api/notes?view=ACTIVE&pinned=true': () => json([]),
  'GET /api/note-tags': () => json([]),
  'GET /api/fitness/routines': () => json([]),
  'GET /api/fitness/workouts': () => json([]),
}

/** Lecturas por defecto que dependen de un identificador. */
const emptyTotals = { incomeCents: 0, expenseCents: 0, balanceCents: 0 }
const defaultPrefixHandlers: [string, Handler][] = [
  ['GET /api/notes?view=ACTIVE&taskId=', () => json([])],
  ['GET /api/finance/budgets?month=', () => json([])],
  ['GET /api/agenda?from=', () => json([])],
  [
    'GET /api/finance/summary?month=',
    () =>
      json({ month: '2026-10', currency: 'EUR', totals: emptyTotals, previousMonth: '2026-09', previousTotals: emptyTotals, byCategory: [] }),
  ],
]

/** Sustituye fetch por un servidor falso: clave "MÉTODO /ruta". */
export function mockFetch(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`
    const handler =
      handlers[key] ?? defaultHandlers[key] ?? defaultPrefixHandlers.find(([prefix]) => key.startsWith(prefix))?.[1]
    if (!handler) throw new Error(`Petición inesperada: ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export const testUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'jorge@example.com',
  displayName: 'Jorge',
  locale: 'es',
  timezone: 'Europe/Madrid',
}
