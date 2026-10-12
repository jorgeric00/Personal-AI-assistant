import { addDays, isoWeekday } from '../../lib/date'
import { WEEKDAYS } from '../tasks/api'
import type { Habit } from './api'

/** Lunes de la semana de una fecha ISO. */
export function mondayOf(iso: string): string {
  return addDays(iso, -(isoWeekday(iso) - 1))
}

/** Si el hábito toca ese día (los semanales valen cualquier día). Antes de crearlo no toca nunca. */
export function isScheduled(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false
  if (habit.frequency === 'WEEKLY' || habit.weekdays.length === 0) return true
  return habit.weekdays.includes(WEEKDAYS[isoWeekday(date) - 1])
}

export interface WeekProgress {
  done: number
  /** Lo esperado en la semana; 0 si el hábito aún no existía. */
  expected: number
}

/**
 * Cumplimiento de una semana (lunes a domingo). En los diarios cuenta los días que tocan y se marcaron; en los
 * semanales, las marcas frente a las veces por semana (sin pedir más días de los que quedaban desde que se creó).
 */
export function weekProgress(habit: Habit, monday: string): WeekProgress {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const checks = new Set(habit.checks)
  if (habit.frequency === 'WEEKLY') {
    const available = days.filter((d) => d >= habit.startDate).length
    return {
      done: days.filter((d) => checks.has(d)).length,
      expected: Math.min(habit.timesPerWeek ?? 1, available),
    }
  }
  const scheduled = days.filter((d) => isScheduled(habit, d))
  return { done: scheduled.filter((d) => checks.has(d)).length, expected: scheduled.length }
}

/**
 * Porcentaje cumplido en las semanas completas o en curso entre dos lunes (incluidos). Lo que aún puede cumplirse (hoy
 * sin marcar, la semana en curso de un semanal) no cuenta como fallado. null si en ese periodo no se esperaba nada.
 */
export function completionRate(habit: Habit, fromMonday: string, toMonday: string, today: string): number | null {
  let done = 0
  let expected = 0
  for (let monday = fromMonday; monday <= toMonday; monday = addDays(monday, 7)) {
    if (habit.frequency === 'WEEKLY') {
      const week = weekProgress(habit, monday)
      // La semana en curso no cuenta como incumplida mientras no acabe
      if (addDays(monday, 6) > today && week.done < week.expected) continue
      done += Math.min(week.done, week.expected)
      expected += week.expected
    } else {
      for (let i = 0; i < 7; i++) {
        const day = addDays(monday, i)
        if (day > today || !isScheduled(habit, day)) continue
        const checked = habit.checks.includes(day)
        // Hoy aún no ha terminado: solo cuenta si ya está hecho
        if (day === today && !checked) continue
        expected += 1
        if (checked) done += 1
      }
    }
  }
  return expected === 0 ? null : Math.round((done / expected) * 100)
}

/** Semanas (lunes) del historial que termina en la semana de hoy. */
export function historyWeeks(today: string, weeks: number): string[] {
  const last = mondayOf(today)
  return Array.from({ length: weeks }, (_, i) => addDays(last, -7 * (weeks - 1 - i)))
}
