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
export function useMeasurements(enabled = true) {
  return useQuery({
    queryKey: keys.measurements,
    queryFn: () => apiFetch<Measurement[]>('/api/fitness/measurements'),
    enabled,
  })
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

export interface WorkoutSet {
  reps: number | null
  weightKg: number | null
  durationSeconds: number | null
  distanceKm: number | null
  done: boolean
}

/** Objetivo copiado de la rutina al empezar; todo nulo en un entrenamiento libre. */
export interface WorkoutTarget {
  targetSets: number | null
  targetRepsMin: number | null
  targetRepsMax: number | null
  targetWeightKg: number | null
  targetDurationSeconds: number | null
  targetDistanceKm: number | null
  restSeconds: number | null
}

export interface WorkoutExercise extends WorkoutTarget {
  id: string
  exercise: Routine['exercises'][number]['exercise']
  notes: string | null
  sets: (WorkoutSet & { id: string })[]
  /** Series hechas la última vez que se terminó un entrenamiento con este ejercicio. */
  previous: { workoutId: string; date: string; sets: (WorkoutSet & { id: string })[] } | null
}

export interface Workout {
  id: string
  routineId: string | null
  name: string
  date: string
  finished: boolean
  finishedAt: string | null
  effort: number | null
  notes: string | null
  exercises: WorkoutExercise[]
}

export interface WorkoutInput {
  name: string
  date: string
  effort: number | null
  notes: string | null
  finished: boolean
  exercises: (WorkoutTarget & { exerciseId: string; notes: string | null; sets: WorkoutSet[] })[]
}

export interface WorkoutSummary {
  id: string
  routineId: string | null
  name: string
  date: string
  finished: boolean
  finishedAt: string | null
  exerciseCount: number
  doneSets: number
}

/** Mejores marcas de un ejercicio; cada valor con la fecha en que se logró. */
export interface ExerciseRecord {
  exerciseId: string
  exerciseName: string
  type: ExerciseType
  sessions: number
  bestWeightKg: number | null
  bestWeightReps: number | null
  bestWeightDate: string | null
  bestReps: number | null
  bestRepsDate: string | null
  longestDurationSeconds: number | null
  longestDurationDate: string | null
  longestDistanceKm: number | null
  longestDistanceDate: string | null
}

const workoutKeys = {
  list: ['fitness', 'workouts'] as const,
  detail: (id: string) => ['fitness', 'workout', id] as const,
  records: ['fitness', 'records'] as const,
}

/** Entrenamientos del más reciente al más antiguo, en curso y terminados. */
export function useWorkouts(enabled = true) {
  return useQuery({ queryKey: workoutKeys.list, queryFn: () => apiFetch<WorkoutSummary[]>('/api/fitness/workouts'), enabled })
}

export function useWorkout(id: string) {
  return useQuery({ queryKey: workoutKeys.detail(id), queryFn: () => apiFetch<Workout>(`/api/fitness/workouts/${id}`) })
}

export function useRecords(enabled = true) {
  return useQuery({
    queryKey: workoutKeys.records,
    queryFn: () => apiFetch<ExerciseRecord[]>('/api/fitness/records'),
    enabled,
  })
}

export function useStartWorkout() {
  return useFitnessMutation((input: { routineId: string | null; date: string | null }) =>
    apiFetch<Workout>('/api/fitness/workouts', { method: 'POST', body: input }),
  )
}

/**
 * Guarda el entrenamiento sin volver a pedir su detalle: la pantalla de la sesión mantiene su propio estado
 * mientras se edita, y solo se refrescan el historial, los récords y los ejercicios en uso.
 */
export function useSaveWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WorkoutInput }) =>
      apiFetch<Workout>(`/api/fitness/workouts/${id}`, { method: 'PUT', body: input }),
    onSuccess: (workout) => {
      queryClient.setQueryData(workoutKeys.detail(workout.id), workout)
      return queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'fitness' && query.queryKey[1] !== 'workout',
      })
    },
  })
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/fitness/workouts/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: workoutKeys.detail(id) })
      return queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'fitness' && query.queryKey[1] !== 'workout',
      })
    },
  })
}
