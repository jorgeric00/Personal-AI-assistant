import type { TFunction } from 'i18next'

import { formatDecimal } from '../../lib/decimal'
import { TARGET_FIELDS, type ExerciseType, type RoutineTarget } from './api'

/** Duración legible: «45 s», «20 min», «1 min 30 s», «1 h 5 min». */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
  if (m > 0) return s > 0 ? `${m} min ${s} s` : `${m} min`
  return `${s} s`
}

/** Resumen del objetivo de un ejercicio: «4 × 6–8 · 60 kg · descanso 2 min». Solo lo que se haya indicado. */
export function formatTarget(type: ExerciseType, target: RoutineTarget, t: TFunction, locale: string): string {
  const fields = TARGET_FIELDS[type]
  const parts: string[] = []
  const reps =
    target.repsMin !== null && target.repsMax !== null && target.repsMax !== target.repsMin
      ? `${target.repsMin}–${target.repsMax}`
      : (target.repsMin ?? target.repsMax)
  if (fields.reps && reps !== null) parts.push(`${target.sets} × ${reps}`)
  else if (fields.duration && type === 'TIMED' && target.durationSeconds !== null)
    parts.push(`${target.sets} × ${formatDuration(target.durationSeconds)}`)
  else if (type !== 'CARDIO' || target.sets > 1) parts.push(t('fitness.routines.setsCount', { count: target.sets }))
  if (fields.weight && target.weightKg !== null) parts.push(`${formatDecimal(target.weightKg, locale, 2)} kg`)
  if (type === 'CARDIO' && target.durationSeconds !== null) parts.push(formatDuration(target.durationSeconds))
  if (fields.distance && target.distanceKm !== null) parts.push(`${formatDecimal(target.distanceKm, locale, 2)} km`)
  if (target.restSeconds) parts.push(t('fitness.routines.restShort', { value: formatDuration(target.restSeconds) }))
  return parts.join(' · ')
}
