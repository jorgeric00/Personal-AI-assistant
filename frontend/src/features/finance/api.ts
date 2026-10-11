import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'

export type MovementKind = 'INCOME' | 'EXPENSE'
export const MOVEMENT_KINDS: MovementKind[] = ['EXPENSE', 'INCOME']

export interface FinanceCategory {
  id: string
  kind: MovementKind
  name: string
  color: string
  archived: boolean
}

export interface FinanceAccount {
  id: string
  name: string
}

export interface Movement {
  id: string
  kind: MovementKind
  amountCents: number
  currency: string
  date: string
  category: FinanceCategory
  account: FinanceAccount | null
  description: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface MovementInput {
  kind: MovementKind
  amountCents: number
  date: string
  categoryId: string | null
  accountId: string | null
  description: string
  tags: string[]
}

export interface Totals {
  incomeCents: number
  expenseCents: number
  balanceCents: number
}

export interface MovementPage {
  items: Movement[]
  page: number
  size: number
  totalItems: number
  totals: Totals
  currency: string
}

export interface MovementFilters {
  from?: string
  to?: string
  kind?: MovementKind
  categoryId?: string
  q?: string
}

export interface CategoryTotal {
  categoryId: string
  name: string
  color: string
  kind: MovementKind
  amountCents: number
}

export interface MonthSummary {
  month: string
  currency: string
  totals: Totals
  previousMonth: string
  previousTotals: Totals
  byCategory: CategoryTotal[]
}

export interface TrendPoint {
  month: string
  incomeCents: number
  expenseCents: number
  balanceCents: number
  savingsCents: number
}

export interface Trend {
  currency: string
  points: TrendPoint[]
}

export const PAGE_SIZE = 50

const keys = {
  all: ['finance'] as const,
  movements: (filters: MovementFilters) => ['finance', 'movements', filters] as const,
  movement: (id: string) => ['finance', 'movement', id] as const,
  summary: (month: string) => ['finance', 'summary', month] as const,
  trend: (to: string, months: number) => ['finance', 'trend', to, months] as const,
  categories: ['finance', 'categories'] as const,
  accounts: ['finance', 'accounts'] as const,
  tags: ['finance', 'tags'] as const,
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return search.toString()
}

export function useMovements(filters: MovementFilters) {
  return useInfiniteQuery({
    queryKey: keys.movements(filters),
    queryFn: ({ pageParam }) =>
      apiFetch<MovementPage>(`/api/finance/movements?${query({ ...filters, page: pageParam, size: PAGE_SIZE })}`),
    initialPageParam: 0,
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.totalItems ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  })
}

export function useMovement(id: string | null) {
  return useQuery({
    queryKey: keys.movement(id ?? ''),
    queryFn: () => apiFetch<Movement>(`/api/finance/movements/${id}`),
    enabled: Boolean(id),
  })
}

export function useMonthSummary(month: string) {
  return useQuery({
    queryKey: keys.summary(month),
    queryFn: () => apiFetch<MonthSummary>(`/api/finance/summary?month=${month}`),
    placeholderData: keepPreviousData,
  })
}

export function useTrend(to: string, months: number) {
  return useQuery({
    queryKey: keys.trend(to, months),
    queryFn: () => apiFetch<Trend>(`/api/finance/trend?to=${to}&months=${months}`),
    placeholderData: keepPreviousData,
  })
}

export function useFinanceCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => apiFetch<FinanceCategory[]>('/api/finance/categories'),
  })
}

export function useAccounts() {
  return useQuery({ queryKey: keys.accounts, queryFn: () => apiFetch<FinanceAccount[]>('/api/finance/accounts') })
}

export function useFinanceTags() {
  return useQuery({
    queryKey: keys.tags,
    queryFn: () => apiFetch<{ name: string; count: number }[]>('/api/finance/tags'),
  })
}

/** Cualquier cambio invalida todo el módulo: los resúmenes dependen de los movimientos y de las categorías. */
function useFinanceMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }) })
}

export function useSaveMovement() {
  return useFinanceMutation(({ id, input }: { id?: string; input: MovementInput }) =>
    id
      ? apiFetch<Movement>(`/api/finance/movements/${id}`, { method: 'PUT', body: input })
      : apiFetch<Movement>('/api/finance/movements', { method: 'POST', body: input }),
  )
}

export function useDeleteMovement() {
  return useFinanceMutation((id: string) => apiFetch<void>(`/api/finance/movements/${id}`, { method: 'DELETE' }))
}

export interface CategoryInput {
  kind: MovementKind
  name: string
  color: string
  archived: boolean
}

export function useSaveCategory() {
  return useFinanceMutation(({ id, input }: { id?: string; input: CategoryInput }) =>
    id
      ? apiFetch<FinanceCategory>(`/api/finance/categories/${id}`, { method: 'PUT', body: input })
      : apiFetch<FinanceCategory>('/api/finance/categories', { method: 'POST', body: input }),
  )
}

export function useDeleteCategory() {
  return useFinanceMutation((id: string) => apiFetch<void>(`/api/finance/categories/${id}`, { method: 'DELETE' }))
}

export function useSaveAccount() {
  return useFinanceMutation(({ id, name }: { id?: string; name: string }) =>
    id
      ? apiFetch<FinanceAccount>(`/api/finance/accounts/${id}`, { method: 'PUT', body: { name } })
      : apiFetch<FinanceAccount>('/api/finance/accounts', { method: 'POST', body: { name } }),
  )
}

export function useDeleteAccount() {
  return useFinanceMutation((id: string) => apiFetch<void>(`/api/finance/accounts/${id}`, { method: 'DELETE' }))
}

/** «2026-10» desplazado n meses. */
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

/** Primer y último día de un mes «2026-10». */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}
