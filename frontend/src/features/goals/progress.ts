import { addDays } from '../../lib/date'
import type { ExerciseRecord, Measurement, WorkoutSummary } from '../fitness/api'
import type { Habit } from '../habits/api'
import { completionRate, historyWeeks, mondayOf } from '../habits/stats'
import type { PlannedMeal } from '../nutrition/api'
import { BODY_METRICS, type Goal } from './api'

/**
 * Progreso calculado con los registros. percent es la barra (0–100); null si aún no hay datos con los que medirlo.
 * missing: el ejercicio o el hábito del objetivo ya no existe.
 */
export interface GoalProgress {
  percent: number | null
  reached: boolean
  current: number | null
  start: number | null
  missing?: boolean
  /** Solo entreno: semanas en que se llegó a los días, de las últimas completas desde el inicio. */
  weeksMet?: { met: number; of: number }
}

const NONE: GoalProgress = { percent: null, reached: false, current: null, start: null }
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

/** Medida corporal: desde el último valor anterior al inicio (o el primero) hasta el último registrado. */
export function bodyProgress(goal: Goal, measurements: Measurement[]): GoalProgress {
  if (!goal.metric || goal.targetValue == null) return NONE
  const key = BODY_METRICS[goal.metric]
  const values = measurements
    .filter((m) => m[key] != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m[key]! }))
  if (values.length === 0) return NONE
  const before = values.filter((v) => v.date <= goal.startDate)
  const start = (before.length > 0 ? before[before.length - 1] : values[0]).value
  const current = values[values.length - 1].value
  const target = goal.targetValue
  const reached = target < start ? current <= target : current >= target
  const percent = start === target ? (reached ? 100 : 0) : clamp(((start - current) / (start - target)) * 100)
  return { percent, reached, current, start }
}

/** Días con algún entrenamiento terminado esta semana frente a la meta, y semanas cumplidas de las 4 anteriores. */
export function trainingProgress(goal: Goal, workouts: WorkoutSummary[], today: string): GoalProgress {
  const target = goal.targetValue ?? 1
  const days = new Set(workouts.filter((w) => w.finished).map((w) => w.date))
  const daysIn = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => days.has(d)).length
  const thisWeek = daysIn(mondayOf(today))
  const previous = historyWeeks(today, 5)
    .slice(0, 4)
    .filter((monday) => addDays(monday, 6) >= goal.startDate)
  return {
    percent: clamp((thisWeek / target) * 100),
    reached: thisWeek >= target,
    current: thisWeek,
    start: null,
    weeksMet: { met: previous.filter((monday) => daysIn(monday) >= target).length, of: previous.length },
  }
}

/** Mejor peso registrado en el ejercicio frente a la meta. */
export function exerciseProgress(goal: Goal, records: ExerciseRecord[]): GoalProgress {
  if (!goal.exerciseId) return { ...NONE, missing: true }
  const best = records.find((r) => r.exerciseId === goal.exerciseId)?.bestWeightKg ?? null
  if (best == null || goal.targetValue == null) return NONE
  return { percent: clamp((best / goal.targetValue) * 100), reached: best >= goal.targetValue, current: best, start: null }
}

/** Porcentaje cumplido del hábito en las últimas 4 semanas (sin contar lo que aún puede cumplirse). */
export function habitProgress(goal: Goal, habits: Habit[], today: string): GoalProgress {
  const habit = habits.find((h) => h.id === goal.habitId)
  if (!habit) return { ...NONE, missing: true }
  const weeks = historyWeeks(today, 4)
  const rate = completionRate(habit, weeks[0], weeks[3], today)
  if (rate == null || goal.targetValue == null) return NONE
  return { percent: clamp((rate / goal.targetValue) * 100), reached: rate >= goal.targetValue, current: rate, start: null }
}

/** Comidas planificadas hasta hoy (últimos 28 días desde el inicio) que se pasaron al diario. */
export function mealPlanProgress(goal: Goal, plans: PlannedMeal[], today: string): GoalProgress {
  const from = [goal.startDate, addDays(today, -27)].sort()[1]
  const due = plans.filter((p) => p.date >= from && p.date <= today)
  if (due.length === 0 || goal.targetValue == null) return NONE
  const rate = Math.round((due.filter((p) => p.logged).length / due.length) * 100)
  return { percent: clamp((rate / goal.targetValue) * 100), reached: rate >= goal.targetValue, current: rate, start: null }
}
