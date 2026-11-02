/** Fechas ISO (AAAA-MM-DD) para la base de datos local, sin depender de la zona horaria del dispositivo. */

export const WEEKDAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const
export type WeekdayName = (typeof WEEKDAY_NAMES)[number]

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function plusDays(iso: string, days: number): string {
  const date = toUtc(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUtc(date)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000)
}

/** Lunes = 0 … domingo = 6. */
export function weekdayIndex(iso: string): number {
  return (toUtc(iso).getUTCDay() + 6) % 7
}

export function weekdayName(iso: string): WeekdayName {
  return WEEKDAY_NAMES[weekdayIndex(iso)]
}

export function mondayOf(iso: string): string {
  return plusDays(iso, -weekdayIndex(iso))
}

/** Suma meses como java.time: si el día no existe en el mes destino, se queda en el último día. */
export function plusMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const month = total - year * 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return fromUtc(new Date(Date.UTC(year, month, Math.min(d, lastDay))))
}

/** Meses completos entre el día 1 de cada fecha (b - a). */
export function monthsBetweenFirstDays(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

/** Fecha de hoy en la zona horaria indicada. */
export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Hora con segundos (HH:MM:SS), como la devuelve la API del servidor. */
export function normalizeTime(time: string | null | undefined): string | null {
  if (!time) return null
  const [h, m, s] = time.split(':')
  return `${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}:${(s ?? '00').slice(0, 2).padStart(2, '0')}`
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && fromUtc(toUtc(value)) === value
}

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?$/.test(value)
}
