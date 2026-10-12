import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'
import type { Weekday } from '../tasks/api'

export type HabitFrequency = 'DAILY' | 'WEEKLY'

/** checks: días cumplidos dentro del rango pedido. */
export interface Habit {
  id: string
  name: string
  color: string
  frequency: HabitFrequency
  /** Solo DAILY; vacío = todos los días. */
  weekdays: Weekday[]
  /** Solo WEEKLY. */
  timesPerWeek: number | null
  startDate: string
  archived: boolean
  checks: string[]
}

export interface HabitInput {
  name: string
  color: string
  frequency: HabitFrequency
  weekdays: Weekday[]
  timesPerWeek: number | null
  archived: boolean
}

const keys = {
  all: ['habits'] as const,
  range: (from: string, to: string) => ['habits', from, to] as const,
}

export function useHabits(from: string, to: string) {
  return useQuery({
    queryKey: keys.range(from, to),
    queryFn: () => apiFetch<Habit[]>(`/api/habits?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  })
}

export function useSaveHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: HabitInput & { id?: string }) =>
      id
        ? apiFetch<Habit>(`/api/habits/${id}`, { method: 'PUT', body: input })
        : apiFetch<Habit>('/api/habits', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeleteHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/habits/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

/** Marca o desmarca un día. Se ve al momento y se confirma con el servidor. */
export function useToggleCheck() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, date, done }: { id: string; date: string; done: boolean }) =>
      apiFetch<void>(`/api/habits/${id}/checks/${date}`, { method: done ? 'PUT' : 'DELETE' }),
    onMutate: async ({ id, date, done }) => {
      await queryClient.cancelQueries({ queryKey: keys.all })
      queryClient.setQueriesData<Habit[]>({ queryKey: keys.all }, (list) =>
        list?.map((habit) =>
          habit.id !== id
            ? habit
            : {
                ...habit,
                checks: done
                  ? [...habit.checks.filter((d) => d !== date), date].sort()
                  : habit.checks.filter((d) => d !== date),
              },
        ),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
