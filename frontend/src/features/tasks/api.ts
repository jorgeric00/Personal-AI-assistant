import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'

export type TaskKind = 'TASK' | 'REMINDER'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
export type TaskStatus = 'PENDING' | 'POSTPONED' | 'DONE'
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
export type TaskView = 'TODAY' | 'UPCOMING' | 'ALL' | 'DONE'

export const WEEKDAYS: Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH']

export interface Category {
  id: string
  name: string
  color: string
}

export interface RecurrenceRule {
  frequency: Frequency
  interval: number
  weekdays: Weekday[] | null
  until: string | null
}

export interface Task {
  id: string
  kind: TaskKind
  title: string
  description: string | null
  dueDate: string | null
  dueTime: string | null
  deadline: string | null
  priority: Priority
  category: Category | null
  status: TaskStatus
  recurrence: RecurrenceRule | null
  reminderMinutesBefore: number | null
  overdue: boolean
  completedAt: string | null
}

export interface TaskInput {
  kind: TaskKind
  title: string
  description: string | null
  dueDate: string | null
  dueTime: string | null
  deadline: string | null
  priority: Priority
  categoryId: string | null
  recurrence: RecurrenceRule | null
  reminderMinutesBefore: number | null
}

export interface CalendarEntry {
  taskId: string
  date: string
  time: string | null
  title: string
  kind: TaskKind
  priority: Priority
  category: Category | null
  done: boolean
  recurring: boolean
}

export interface TaskFilters {
  categoryId?: string
  priority?: Priority
  kind?: TaskKind
}

const keys = {
  all: ['tasks'] as const,
  list: (view: TaskView, filters: TaskFilters) => ['tasks', 'list', view, filters] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  calendar: (from: string, to: string) => ['tasks', 'calendar', from, to] as const,
  categories: ['task-categories'] as const,
}

function query(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  return search.toString()
}

export function useTasks(view: TaskView, filters: TaskFilters = {}) {
  return useQuery({
    queryKey: keys.list(view, filters),
    queryFn: () => apiFetch<Task[]>(`/api/tasks?${query({ view, ...filters })}`),
  })
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => apiFetch<Task>(`/api/tasks/${id}`),
    enabled: Boolean(id),
  })
}

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: keys.calendar(from, to),
    queryFn: () => apiFetch<CalendarEntry[]>(`/api/tasks/calendar?${query({ from, to })}`),
  })
}

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => apiFetch<Category[]>('/api/task-categories') })
}

function useTaskMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useSaveTask() {
  return useTaskMutation(({ id, input }: { id?: string; input: TaskInput }) =>
    id
      ? apiFetch<Task>(`/api/tasks/${id}`, { method: 'PUT', body: input })
      : apiFetch<Task>('/api/tasks', { method: 'POST', body: input }),
  )
}

export function useDeleteTask() {
  return useTaskMutation((id: string) => apiFetch<void>(`/api/tasks/${id}`, { method: 'DELETE' }))
}

export function useCompleteTask() {
  return useTaskMutation(({ id, occurrenceDate }: { id: string; occurrenceDate: string }) =>
    apiFetch<Task>(`/api/tasks/${id}/complete`, { method: 'POST', body: { occurrenceDate } }),
  )
}

export function useUncompleteTask() {
  return useTaskMutation(({ id, occurrenceDate }: { id: string; occurrenceDate: string }) =>
    apiFetch<Task>(`/api/tasks/${id}/uncomplete`, { method: 'POST', body: { occurrenceDate } }),
  )
}

export function usePostponeTask() {
  return useTaskMutation(({ id, date }: { id: string; date: string }) =>
    apiFetch<Task>(`/api/tasks/${id}/postpone`, { method: 'POST', body: { date } }),
  )
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; color: string }) =>
      apiFetch<Category>('/api/task-categories', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.categories }),
  })
}

/** Colores disponibles para las categorías (legibles en modo claro y oscuro). */
export const CATEGORY_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#64748b']
