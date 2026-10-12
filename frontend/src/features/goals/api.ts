import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'
import type { Metric } from '../fitness/api'

export type GoalKind = 'BODY' | 'TRAINING' | 'EXERCISE' | 'HABIT' | 'MEAL_PLAN' | 'CUSTOM'
export const GOAL_KINDS: GoalKind[] = ['BODY', 'TRAINING', 'EXERCISE', 'HABIT', 'MEAL_PLAN', 'CUSTOM']
export type BodyMetric = 'WEIGHT_KG' | 'BODY_FAT_PCT' | 'WAIST_CM' | 'CHEST_CM' | 'HIP_CM' | 'ARM_CM' | 'THIGH_CM'
export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'DROPPED'

/** La medida del objetivo en el registro de evolución. */
export const BODY_METRICS: Record<BodyMetric, Metric> = {
  WEIGHT_KG: 'weightKg',
  BODY_FAT_PCT: 'bodyFatPct',
  WAIST_CM: 'waistCm',
  CHEST_CM: 'chestCm',
  HIP_CM: 'hipCm',
  ARM_CM: 'armCm',
  THIGH_CM: 'thighCm',
}

export interface Goal {
  id: string
  title: string
  kind: GoalKind
  metric: BodyMetric | null
  targetValue: number | null
  exerciseId: string | null
  habitId: string | null
  startDate: string
  targetDate: string | null
  notes: string | null
  status: GoalStatus
  achievedOn: string | null
}

export type GoalInput = Pick<
  Goal,
  'title' | 'kind' | 'metric' | 'targetValue' | 'exerciseId' | 'habitId' | 'targetDate' | 'notes' | 'status'
>

const keys = { all: ['goals'] as const }

export function useGoals() {
  return useQuery({ queryKey: keys.all, queryFn: () => apiFetch<Goal[]>('/api/goals') })
}

export function useSaveGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: GoalInput & { id?: string }) =>
      id
        ? apiFetch<Goal>(`/api/goals/${id}`, { method: 'PUT', body: input })
        : apiFetch<Goal>('/api/goals', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeleteGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
