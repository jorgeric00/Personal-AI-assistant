/** Cálculos de la agenda sobre fechas y horas locales: solapamientos y reparto de horas. */

import { daysBetween } from '../../lib/date'
import type { AgendaItem, CategoryRef } from './api'

const ORIGIN = '2000-01-01'
const DAY = 24 * 60

/** Clave única de una aparición. */
export function itemKey(item: Pick<AgendaItem, 'kind' | 'id' | 'date'>): string {
  return `${item.kind}:${item.id}:${item.date}`
}

function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

type Timed = Pick<AgendaItem, 'startDate' | 'startTime' | 'endDate' | 'endTime'>

/** Intervalo en minutos absolutos; null si no tiene horas (todo el día o entrenamientos sin hora). */
export function interval(item: Timed): [number, number] | null {
  if (!item.startTime || !item.endTime) return null
  return [
    daysBetween(ORIGIN, item.startDate) * DAY + minutes(item.startTime),
    daysBetween(ORIGIN, item.endDate) * DAY + minutes(item.endTime),
  ]
}

function counts(item: AgendaItem): boolean {
  return item.status !== 'CANCELLED' && item.status !== 'MISSED'
}

function overlaps(a: [number, number], b: [number, number]) {
  return a[0] < b[1] && b[0] < a[1]
}

/** Apariciones con hora que se pisan con alguna otra (las canceladas o no hechas no cuentan). */
export function findOverlaps(items: AgendaItem[]): Set<string> {
  const timed = items
    .filter(counts)
    .map((item) => ({ item, range: interval(item) }))
    .filter((t): t is { item: AgendaItem; range: [number, number] } => t.range !== null)
    .sort((a, b) => a.range[0] - b.range[0])
  const result = new Set<string>()
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length && timed[j].range[0] < timed[i].range[1]; j++) {
      if (overlaps(timed[i].range, timed[j].range)) {
        result.add(itemKey(timed[i].item))
        result.add(itemKey(timed[j].item))
      }
    }
  }
  return result
}

/** Elementos de la agenda que se pisan con un borrador (sin contar la propia actividad que se edita). */
export function conflictsWith(draft: Timed, items: AgendaItem[], excludeActivityId?: string): AgendaItem[] {
  const range = interval(draft)
  if (!range) return []
  return items.filter((item) => {
    if (!counts(item) || (item.kind === 'ACTIVITY' && item.id === excludeActivityId)) return false
    const other = interval(item)
    return other !== null && overlaps(range, other)
  })
}

/** ¿La aparición ocupa ese día? (las de varios días aparecen en cada uno). */
export function coversDay(item: AgendaItem, day: string): boolean {
  if (day < item.startDate || day > item.endDate) return false
  // Si acaba justo a medianoche no ocupa el día siguiente
  return !(day === item.endDate && day !== item.startDate && item.endTime === '00:00:00')
}

export interface CategoryHours {
  category: CategoryRef
  plannedMinutes: number
  doneMinutes: number
}

export interface PeriodSummary {
  hours: CategoryHours[]
  /** Apariciones ya pasadas (o de hoy) que contaban: actividades y días de entreno. */
  due: number
  done: number
  missed: number
  /** Pasadas que siguen planificadas o confirmadas: falta marcar si se hicieron. */
  unreviewed: number
}

/**
 * Resumen de un periodo: horas por categoría (solo actividades con hora, recortadas al periodo) y plan frente a
 * realizado de lo que ya debía haber pasado.
 */
export function summarize(items: AgendaItem[], from: string, to: string, today: string): PeriodSummary {
  const start = daysBetween(ORIGIN, from) * DAY
  const end = (daysBetween(ORIGIN, to) + 1) * DAY
  const byCategory = new Map<string, CategoryHours>()
  const summary: PeriodSummary = { hours: [], due: 0, done: 0, missed: 0, unreviewed: 0 }
  for (const item of items) {
    const range = interval(item)
    if (item.category && range && item.status !== 'CANCELLED') {
      const clipped = Math.max(0, Math.min(end, range[1]) - Math.max(start, range[0]))
      const entry = byCategory.get(item.category.id) ?? { category: item.category, plannedMinutes: 0, doneMinutes: 0 }
      entry.plannedMinutes += clipped
      if (item.status === 'DONE') entry.doneMinutes += clipped
      byCategory.set(item.category.id, entry)
    }
    if (item.status === 'CANCELLED' || item.date > today || item.date < from || item.date > to) continue
    // Un día de rutina de hoy aún se puede entrenar: no cuenta hasta que pase
    if (item.kind === 'ROUTINE' && item.status === 'PLANNED') continue
    summary.due++
    if (item.status === 'DONE') summary.done++
    else if (item.status === 'MISSED') summary.missed++
    else if (item.kind === 'ACTIVITY' && item.date < today) summary.unreviewed++
  }
  summary.hours = [...byCategory.values()]
    .filter((h) => h.plannedMinutes > 0)
    .sort((a, b) => b.plannedMinutes - a.plannedMinutes)
  return summary
}

/** «1 h 30 min», «45 min», «2 h». */
export function formatMinutes(total: number, units: { h: string; min: string }): string {
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  if (h === 0) return `${m} ${units.min}`
  return m === 0 ? `${h} ${units.h}` : `${h} ${units.h} ${m} ${units.min}`
}
