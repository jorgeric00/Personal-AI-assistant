import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'

export type Goal = 'LOSE_FAT' | 'GAIN_MUSCLE' | 'MAINTAIN' | 'ENDURANCE' | 'CUSTOM'
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'
export type Experience = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export const GOALS: Goal[] = ['LOSE_FAT', 'GAIN_MUSCLE', 'MAINTAIN', 'ENDURANCE', 'CUSTOM']
export const ACTIVITY_LEVELS: ActivityLevel[] = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']
export const EXPERIENCES: Experience[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']

export interface ProfileInput {
  birthDate: string | null
  heightCm: number | null
  startWeightKg: number | null
  goal: Goal | null
  goalDetails: string | null
  activityLevel: ActivityLevel | null
  experience: Experience | null
  daysPerWeek: number | null
  minutesPerSession: number | null
  foodPreferences: string | null
  foodAvoid: string | null
  equipment: string | null
  notes: string | null
}

export interface Profile extends ProfileInput {
  age: number | null
  currentWeightKg: number | null
  /** Fecha del registro del que sale el peso actual; null si es el peso inicial. */
  currentWeightDate: string | null
}

/** Valores de un registro de evolución. Todos opcionales. */
export const METRICS = ['weightKg', 'bodyFatPct', 'waistCm', 'chestCm', 'hipCm', 'armCm', 'thighCm'] as const
export type Metric = (typeof METRICS)[number]

export const METRIC_UNITS: Record<Metric, string> = {
  weightKg: 'kg',
  bodyFatPct: '%',
  waistCm: 'cm',
  chestCm: 'cm',
  hipCm: 'cm',
  armCm: 'cm',
  thighCm: 'cm',
}

/** Decimales que admite cada valor (los mismos que valida el servidor). */
export const METRIC_DECIMALS: Record<Metric, number> = {
  weightKg: 2,
  bodyFatPct: 1,
  waistCm: 1,
  chestCm: 1,
  hipCm: 1,
  armCm: 1,
  thighCm: 1,
}

export type MeasurementInput = { date: string; notes: string | null } & Record<Metric, number | null>

export type Measurement = MeasurementInput & { id: string }

const keys = {
  all: ['fitness'] as const,
  profile: ['fitness', 'profile'] as const,
  measurements: ['fitness', 'measurements'] as const,
}

export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => apiFetch<Profile>('/api/fitness/profile') })
}

/** Registros de evolución, del más reciente al más antiguo. */
export function useMeasurements() {
  return useQuery({ queryKey: keys.measurements, queryFn: () => apiFetch<Measurement[]>('/api/fitness/measurements') })
}

/** El peso actual del perfil depende de los registros, así que cualquier cambio invalida todo el módulo. */
function useFitnessMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }) })
}

export function useSaveProfile() {
  return useFitnessMutation((input: ProfileInput) => apiFetch<Profile>('/api/fitness/profile', { method: 'PUT', body: input }))
}

export function useSaveMeasurement() {
  return useFitnessMutation(({ id, input }: { id?: string; input: MeasurementInput }) =>
    id
      ? apiFetch<Measurement>(`/api/fitness/measurements/${id}`, { method: 'PUT', body: input })
      : apiFetch<Measurement>('/api/fitness/measurements', { method: 'POST', body: input }),
  )
}

export function useDeleteMeasurement() {
  return useFitnessMutation((id: string) => apiFetch<void>(`/api/fitness/measurements/${id}`, { method: 'DELETE' }))
}
