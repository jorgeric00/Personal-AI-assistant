import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'
import type { RecurrenceRule } from '../tasks/api'

export type ActivityStatus = 'PLANNED' | 'CONFIRMED' | 'DONE' | 'MISSED' | 'CANCELLED'
/** ACTIVITY: actividad de la agenda; WORKOUT: entrenamiento registrado; ROUTINE: día de rutina sin entrenamiento. */
export type ItemKind = 'ACTIVITY' | 'WORKOUT' | 'ROUTINE'

export const STATUSES: ActivityStatus[] = ['PLANNED', 'CONFIRMED', 'DONE', 'MISSED', 'CANCELLED']

export interface CategoryRef {
  id: string
  name: string
  color: string
}

export interface AgendaCategory extends CategoryRef {
  archived: boolean
  inUse: boolean
}

export interface AgendaItem {
  kind: ItemKind
  id: string
  /** Fecha de inicio de la aparición. */
  date: string
  title: string
  category: CategoryRef | null
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
  location: string | null
  status: ActivityStatus
  recurring: boolean
}

export interface Activity {
  id: string
  title: string
  category: CategoryRef
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
  description: string | null
  location: string | null
  recurrence: RecurrenceRule | null
}

export interface ActivityInput {
  title: string
  categoryId: string
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
  description: string | null
  location: string | null
  recurrence: RecurrenceRule | null
}

export interface CategoryInput {
  name: string
  color: string
  archived: boolean
}

const keys = {
  all: ['agenda'] as const,
  range: (from: string, to: string) => ['agenda', 'range', from, to] as const,
  activity: (id: string) => ['agenda', 'activity', id] as const,
  categories: ['agenda', 'categories'] as const,
}

/** Entrenamientos y rutinas cambian desde otro módulo, así que la agenda se vuelve a pedir al entrar. */
export function useAgenda(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: keys.range(from, to),
    queryFn: () => apiFetch<AgendaItem[]>(`/api/agenda?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    enabled,
  })
}

export function useActivity(id: string | null) {
  return useQuery({
    queryKey: keys.activity(id ?? ''),
    queryFn: () => apiFetch<Activity>(`/api/agenda/activities/${id}`),
    enabled: Boolean(id),
  })
}

export function useAgendaCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => apiFetch<AgendaCategory[]>('/api/agenda/categories') })
}

function useAgendaMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }) })
}

export function useSaveActivity() {
  return useAgendaMutation(({ id, input }: { id?: string; input: ActivityInput }) =>
    id
      ? apiFetch<Activity>(`/api/agenda/activities/${id}`, { method: 'PUT', body: input })
      : apiFetch<Activity>('/api/agenda/activities', { method: 'POST', body: input }),
  )
}

export function useDeleteActivity() {
  return useAgendaMutation((id: string) => apiFetch<void>(`/api/agenda/activities/${id}`, { method: 'DELETE' }))
}

export function useSetStatus() {
  return useAgendaMutation(({ id, date, status }: { id: string; date: string; status: ActivityStatus }) =>
    apiFetch<void>(`/api/agenda/activities/${id}/occurrences/${date}`, { method: 'PUT', body: { status } }),
  )
}

export function useSaveAgendaCategory() {
  return useAgendaMutation(({ id, input }: { id?: string; input: CategoryInput }) =>
    id
      ? apiFetch<AgendaCategory>(`/api/agenda/categories/${id}`, { method: 'PUT', body: input })
      : apiFetch<AgendaCategory>('/api/agenda/categories', { method: 'POST', body: input }),
  )
}

export function useDeleteAgendaCategory() {
  return useAgendaMutation((id: string) => apiFetch<void>(`/api/agenda/categories/${id}`, { method: 'DELETE' }))
}
