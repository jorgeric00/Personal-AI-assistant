import { daysBetween, mondayOf, monthsBetweenFirstDays, plusDays, plusMonths, weekdayName, type WeekdayName, WEEKDAY_NAMES } from './dates'

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

const MAX_ITERATIONS = 5_000

/**
 * Regla de repetición, igual que Recurrence.java en el servidor. Las apariciones se calculan siempre a partir de la
 * fecha ancla (la primera aparición), así que posponer o completar tarde una aparición no desplaza las siguientes.
 */
export class Recurrence {
  readonly frequency: Frequency
  readonly interval: number
  readonly weekdays: WeekdayName[]
  readonly anchor: string
  readonly until: string | null

  constructor(
    frequency: Frequency,
    interval: number,
    weekdays: readonly WeekdayName[] | null | undefined,
    anchor: string,
    until: string | null,
  ) {
    this.frequency = frequency
    this.interval = interval
    // En el orden de la semana, como EnumSet<DayOfWeek> en el servidor.
    this.weekdays = WEEKDAY_NAMES.filter((day) => (weekdays ?? []).includes(day))
    this.anchor = anchor
    this.until = until
  }

  /** Primera aparición estrictamente posterior a la fecha, o null si ya no hay más. */
  nextAfter(date: string): string | null {
    return this.firstOnOrAfter(plusDays(date, 1))
  }

  /** Primera aparición en la fecha o después, o null si ya no hay más. */
  firstOnOrAfter(date: string): string | null {
    const from = date < this.anchor ? this.anchor : date
    let candidate: string | null
    if (this.frequency === 'DAILY') {
      const steps = Math.ceil(daysBetween(this.anchor, from) / this.interval)
      candidate = plusDays(this.anchor, steps * this.interval)
    } else if (this.frequency === 'WEEKLY') {
      candidate = this.nextWeekly(from)
    } else {
      candidate = this.nextMonthly(from)
    }
    return candidate === null || (this.until !== null && candidate > this.until) ? null : candidate
  }

  /** Apariciones entre from y to (incluidas), empezando a contar en start. */
  occurrencesBetween(start: string, from: string, to: string): string[] {
    const result: string[] = []
    let next = this.firstOnOrAfter(start > from ? start : from)
    while (next !== null && next <= to && result.length < MAX_ITERATIONS) {
      result.push(next)
      next = this.nextAfter(next)
    }
    return result
  }

  private nextWeekly(from: string): string | null {
    const days = this.weekdays.length === 0 ? [weekdayName(this.anchor)] : this.weekdays
    const anchorWeek = mondayOf(this.anchor)
    let candidate = from
    for (let i = 0; i < 7 * this.interval + 7; i++) {
      const weeks = Math.floor(daysBetween(anchorWeek, mondayOf(candidate)) / 7)
      if (weeks % this.interval === 0 && days.includes(weekdayName(candidate))) return candidate
      candidate = plusDays(candidate, 1)
    }
    return null
  }

  private nextMonthly(from: string): string | null {
    const months = monthsBetweenFirstDays(this.anchor, from)
    const step = Math.max(0, Math.trunc(months / this.interval))
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // Siempre desde el ancla: el día 31 pasa a ser el último día en meses más cortos y vuelve al 31 después.
      const candidate = plusMonths(this.anchor, (step + i) * this.interval)
      if (candidate >= from) return candidate
    }
    return null
  }

  weekdaysAsString(): string | null {
    return this.weekdays.length === 0 ? null : this.weekdays.join(',')
  }

  static parseWeekdays(value: string | null): WeekdayName[] {
    return value ? (value.split(',').map((d) => d.trim()) as WeekdayName[]) : []
  }
}
