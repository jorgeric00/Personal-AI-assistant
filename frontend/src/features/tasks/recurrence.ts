import type { Frequency, RecurrenceRule, Weekday } from './api'

export type RepeatChoice = 'none' | Frequency | 'custom'

/** Campos de formulario de una regla de repetición (compartidos por tareas y actividades). */
export interface RecurrenceFieldValues {
  repeat: RepeatChoice
  interval: string
  frequency: Frequency
  weekdays: Weekday[]
  until: string
}

export function recurrenceToFields(recurrence: RecurrenceRule | null | undefined): RecurrenceFieldValues {
  const isCustom =
    recurrence && (recurrence.interval !== 1 || (recurrence.weekdays?.length ?? 0) > 0 || recurrence.until)
  return {
    repeat: !recurrence ? 'none' : isCustom ? 'custom' : recurrence.frequency,
    interval: String(recurrence?.interval ?? 1),
    frequency: recurrence?.frequency ?? 'WEEKLY',
    weekdays: recurrence?.weekdays ?? [],
    until: recurrence?.until ?? '',
  }
}

export function recurrenceFromFields(form: RecurrenceFieldValues): RecurrenceRule | null {
  if (form.repeat === 'none') return null
  if (form.repeat !== 'custom') return { frequency: form.repeat, interval: 1, weekdays: null, until: null }
  return {
    frequency: form.frequency,
    interval: Math.min(365, Math.max(1, Math.trunc(Number(form.interval)) || 1)),
    weekdays: form.frequency === 'WEEKLY' && form.weekdays.length > 0 ? form.weekdays : null,
    until: form.until || null,
  }
}
