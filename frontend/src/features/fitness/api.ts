import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'
import type { Weekday } from '../tasks/api'

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

export type MuscleGroup = 'CHEST' | 'BACK' | 'LEGS' | 'SHOULDERS' | 'ARMS' | 'CORE' | 'FULL_BODY' | 'CARDIO'
/** Qué se anota al hacer el ejercicio: peso y repeticiones, solo repeticiones, tiempo, o tiempo y distancia. */
export type ExerciseType = 'STRENGTH' | 'BODYWEIGHT' | 'TIMED' | 'CARDIO'

export const MUSCLE_GROUPS: MuscleGroup[] = ['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'CORE', 'FULL_BODY', 'CARDIO']
export const EXERCISE_TYPES: ExerciseType[] = ['STRENGTH', 'BODYWEIGHT', 'TIMED', 'CARDIO']

export interface ExerciseInput {
  name: string
  muscleGroup: MuscleGroup
  type: ExerciseType
  equipment: string | null
  instructions: string | null
  safety: string | null
  archived: boolean
}

export interface Exercise extends ExerciseInput {
  id: string
  /** Está en alguna rutina: no se puede borrar, solo archivar. */
  inUse: boolean
}

/** Objetivo de un ejercicio dentro de una rutina. Tiempos en segundos. */
export interface RoutineTarget {
  sets: number
  repsMin: number | null
  repsMax: number | null
  weightKg: number | null
  durationSeconds: number | null
  distanceKm: number | null
  restSeconds: number | null
  notes: string | null
}

export interface RoutineInput {
  name: string
  notes: string | null
  weekdays: Weekday[]
  exercises: (RoutineTarget & { exerciseId: string })[]
}

export interface Routine {
  id: string
  name: string
  notes: string | null
  weekdays: Weekday[]
  exercises: (RoutineTarget & {
    id: string
    exercise: Pick<Exercise, 'id' | 'name' | 'muscleGroup' | 'type' | 'archived'>
  })[]
}

/** Campos del objetivo que tienen sentido para cada tipo de ejercicio. */
export const TARGET_FIELDS: Record<ExerciseType, { reps: boolean; weight: boolean; duration: boolean; distance: boolean }> = {
  STRENGTH: { reps: true, weight: true, duration: false, distance: false },
  BODYWEIGHT: { reps: true, weight: false, duration: false, distance: false },
  TIMED: { reps: false, weight: false, duration: true, distance: false },
  CARDIO: { reps: false, weight: false, duration: true, distance: true },
}

const trainingKeys = {
  exercises: ['fitness', 'exercises'] as const,
  routines: ['fitness', 'routines'] as const,
}

/** Catálogo de ejercicios (incluidos los archivados), ordenado por nombre. */
export function useExercises(enabled = true) {
  return useQuery({ queryKey: trainingKeys.exercises, queryFn: () => apiFetch<Exercise[]>('/api/fitness/exercises'), enabled })
}

export function useRoutines(enabled = true) {
  return useQuery({ queryKey: trainingKeys.routines, queryFn: () => apiFetch<Routine[]>('/api/fitness/routines'), enabled })
}

export function useSaveExercise() {
  return useFitnessMutation(({ id, input }: { id?: string; input: ExerciseInput }) =>
    id
      ? apiFetch<Exercise>(`/api/fitness/exercises/${id}`, { method: 'PUT', body: input })
      : apiFetch<Exercise>('/api/fitness/exercises', { method: 'POST', body: input }),
  )
}

export function useDeleteExercise() {
  return useFitnessMutation((id: string) => apiFetch<void>(`/api/fitness/exercises/${id}`, { method: 'DELETE' }))
}

export function useSaveRoutine() {
  return useFitnessMutation(({ id, input }: { id?: string; input: RoutineInput }) =>
    id
      ? apiFetch<Routine>(`/api/fitness/routines/${id}`, { method: 'PUT', body: input })
      : apiFetch<Routine>('/api/fitness/routines', { method: 'POST', body: input }),
  )
}

export function useDeleteRoutine() {
  return useFitnessMutation((id: string) => apiFetch<void>(`/api/fitness/routines/${id}`, { method: 'DELETE' }))
}
