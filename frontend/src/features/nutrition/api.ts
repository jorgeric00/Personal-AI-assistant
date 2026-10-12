import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'

export type Meal = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'
export const MEALS: Meal[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

/** Alimento con cantidad y nutrientes opcionales; estimated = nutrientes estimados, no confirmados. */
export interface Food {
  name: string
  quantity: number | null
  unit: string | null
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  estimated: boolean
}

export interface Entry {
  id: string
  date: string
  meal: Meal
  food: Food
}

/** Sumas de lo anotado; withoutCalories cuenta los alimentos sin calorías, que no suman. */
export interface Totals {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  entries: number
  withoutCalories: number
  /** Alguna suma incluye valores estimados; estimatedFields dice cuáles. */
  estimated: boolean
  estimatedFields: ('calories' | 'proteinG' | 'carbsG' | 'fatG')[]
}

export interface Target {
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  waterMl: number | null
}

export interface MealDay {
  meal: Meal
  note: string | null
  entries: Entry[]
  totals: Totals
}

export interface NutritionDay {
  date: string
  waterMl: number
  meals: MealDay[]
  totals: Totals
  target: Target
}

export interface Summary {
  days: { date: string; totals: Totals; waterMl: number }[]
  target: Target
}

export interface SavedMeal {
  id: string
  name: string
  meal: Meal | null
  items: Food[]
  totals: Totals
}

/** Comida planificada: no cuenta como comida hasta que se registra (logged) en el diario. */
export interface PlannedMeal {
  id: string
  date: string
  meal: Meal
  title: string
  savedMealId: string | null
  notes: string | null
  prepDate: string | null
  prepared: boolean
  logged: boolean
}

export interface PlanInput {
  date: string
  meal: Meal
  title: string | null
  savedMealId: string | null
  notes: string | null
  prepDate: string | null
}

const keys = {
  all: ['nutrition'] as const,
  day: (date: string) => ['nutrition', 'day', date] as const,
  summary: (from: string, to: string) => ['nutrition', 'summary', from, to] as const,
  savedMeals: ['nutrition', 'saved-meals'] as const,
  plan: (from: string, to: string) => ['nutrition', 'plan', from, to] as const,
}

export function useNutritionDay(date: string) {
  return useQuery({
    queryKey: keys.day(date),
    queryFn: () => apiFetch<NutritionDay>(`/api/nutrition/days/${date}`),
    placeholderData: keepPreviousData,
  })
}

export function useNutritionSummary(from: string, to: string) {
  return useQuery({
    queryKey: keys.summary(from, to),
    queryFn: () => apiFetch<Summary>(`/api/nutrition/summary?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  })
}

export function useSavedMeals() {
  return useQuery({ queryKey: keys.savedMeals, queryFn: () => apiFetch<SavedMeal[]>('/api/nutrition/saved-meals') })
}

function useNutritionMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }) })
}

export function useSaveEntry() {
  return useNutritionMutation(({ id, date, meal, food }: { id?: string; date: string; meal: Meal; food: Food }) =>
    id
      ? apiFetch<Entry>(`/api/nutrition/entries/${id}`, { method: 'PUT', body: { date, meal, food } })
      : apiFetch<Entry>('/api/nutrition/entries', { method: 'POST', body: { date, meal, food } }),
  )
}

export function useDeleteEntry() {
  return useNutritionMutation((id: string) => apiFetch<void>(`/api/nutrition/entries/${id}`, { method: 'DELETE' }))
}

export function useSetWater() {
  return useNutritionMutation(({ date, waterMl }: { date: string; waterMl: number }) =>
    apiFetch<NutritionDay>(`/api/nutrition/days/${date}/water`, { method: 'PUT', body: { waterMl } }),
  )
}

export function useSetNote() {
  return useNutritionMutation(({ date, meal, note }: { date: string; meal: Meal; note: string }) =>
    apiFetch<NutritionDay>(`/api/nutrition/days/${date}/notes`, { method: 'PUT', body: { meal, note } }),
  )
}

export function useSaveTarget() {
  return useNutritionMutation((target: Target) =>
    apiFetch<Target>('/api/nutrition/targets', { method: 'PUT', body: target }),
  )
}

export function useSaveSavedMeal() {
  return useNutritionMutation(({ name, meal, items }: { name: string; meal: Meal | null; items: Food[] }) =>
    apiFetch<SavedMeal>('/api/nutrition/saved-meals', { method: 'POST', body: { name, meal, items } }),
  )
}

export function useDeleteSavedMeal() {
  return useNutritionMutation((id: string) =>
    apiFetch<void>(`/api/nutrition/saved-meals/${id}`, { method: 'DELETE' }),
  )
}

export function useLogSavedMeal() {
  return useNutritionMutation(({ id, date, meal }: { id: string; date: string; meal: Meal }) =>
    apiFetch<NutritionDay>(`/api/nutrition/saved-meals/${id}/log`, { method: 'POST', body: { date, meal } }),
  )
}

export function usePlan(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: keys.plan(from, to),
    queryFn: () => apiFetch<PlannedMeal[]>(`/api/nutrition/plan?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useSavePlan() {
  return useNutritionMutation(({ id, ...input }: PlanInput & { id?: string }) =>
    id
      ? apiFetch<PlannedMeal>(`/api/nutrition/plan/${id}`, { method: 'PUT', body: input })
      : apiFetch<PlannedMeal>('/api/nutrition/plan', { method: 'POST', body: input }),
  )
}

export function useDeletePlan() {
  return useNutritionMutation((id: string) => apiFetch<void>(`/api/nutrition/plan/${id}`, { method: 'DELETE' }))
}

export function useSetPrepared() {
  return useNutritionMutation(({ id, prepared }: { id: string; prepared: boolean }) =>
    apiFetch<PlannedMeal>(`/api/nutrition/plan/${id}/prepared`, { method: 'PUT', body: { prepared } }),
  )
}

export function useLogPlan() {
  return useNutritionMutation((id: string) =>
    apiFetch<PlannedMeal>(`/api/nutrition/plan/${id}/log`, { method: 'POST', body: {} }),
  )
}

export function useCopyWeek() {
  return useNutritionMutation(({ from, to }: { from: string; to: string }) =>
    apiFetch<PlannedMeal[]>('/api/nutrition/plan/copy-week', { method: 'POST', body: { from, to } }),
  )
}
