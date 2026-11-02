import { plusDays, todayIn } from '../dates'
import { MESSAGES } from '../messages'
import { Recurrence, type Frequency } from '../recurrence'
import type { LocalContext } from '../router'
import { currentLocale } from './account'

/**
 * Avisos de tareas y recordatorios que el móvil tiene que programar, con las mismas reglas que ReminderNotifier del
 * servidor: cada aparición pendiente con hora y aviso, también las siguientes de las tareas que se repiten.
 */

/** Días por delante que se programan. Se vuelven a calcular al abrir la app y con cada cambio. */
export const REMINDER_HORIZON_DAYS = 30
/** Android limita las alarmas por app; se programan las más próximas. */
export const MAX_SCHEDULED = 200

export interface ScheduledReminder {
  /** Identificador numérico estable de la aparición (lo exige el sistema). */
  id: number
  at: Date
  title: string
  body: string
  url: string
}

interface ReminderTaskRow {
  id: string
  title: string
  due_date: string
  due_time: string
  reminder_minutes_before: number
  recurrence_frequency: Frequency | null
  recurrence_interval: number | null
  recurrence_weekdays: string | null
  recurrence_anchor: string | null
  recurrence_until: string | null
}

export function upcomingReminders(ctx: LocalContext): ScheduledReminder[] {
  const now = ctx.now()
  const today = ctx.today()
  const until = plusDays(today, REMINDER_HORIZON_DAYS)
  const language = currentLocale(ctx) === 'en' ? 'en' : 'es'
  const tasks = ctx.db.all<ReminderTaskRow>(
    `select * from task where status <> 'DONE' and reminder_minutes_before is not null and due_time is not null
       and due_date <= ?`,
    [until],
  )
  const reminders: ScheduledReminder[] = []
  for (const task of tasks) {
    const dates = [task.due_date]
    if (task.recurrence_frequency) {
      const recurrence = new Recurrence(
        task.recurrence_frequency,
        task.recurrence_interval ?? 1,
        Recurrence.parseWeekdays(task.recurrence_weekdays),
        task.recurrence_anchor!,
        task.recurrence_until,
      )
      // Las siguientes apariciones también se avisan aunque la actual siga pendiente.
      dates.push(...recurrence.occurrencesBetween(plusDays(task.due_date, 1), today, until))
    }
    for (const date of dates) {
      const at = new Date(zonedInstant(date, task.due_time, ctx.timeZone).getTime() - task.reminder_minutes_before * 60_000)
      if (at <= now) continue
      reminders.push({
        id: reminderId(`task-${task.id}-${date}`),
        at,
        title: task.title,
        body: reminderBody(date, task.due_time, todayIn(ctx.timeZone, at), language),
        url: '/tareas',
      })
    }
  }
  return reminders.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED)
}

/** «Hoy a las 18:30», «Mañana a las…» o la fecha, contado desde el día en que suena el aviso. */
function reminderBody(date: string, time: string, noticeDay: string, language: 'es' | 'en'): string {
  const messages = MESSAGES[language]
  const hhmm = time.slice(0, 5)
  if (date === noticeDay) return format(messages['push.reminder.today'], hhmm)
  if (date === plusDays(noticeDay, 1)) return format(messages['push.reminder.tomorrow'], hhmm)
  const day = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  )
  return format(messages['push.reminder.on'], day, hhmm)
}

function format(template: string, ...args: string[]): string {
  return template.replace(/\{(\d)\}/g, (_, i: string) => args[Number(i)] ?? '')
}

/** Instante en que una fecha y hora locales ocurren en la zona horaria indicada. */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, h, min)
  let instant = wall - offsetAt(wall, timeZone)
  // Cerca de un cambio de hora el desfase puede ser otro: se corrige con el del instante calculado.
  const corrected = wall - offsetAt(instant, timeZone)
  if (corrected !== instant) instant = corrected
  return new Date(instant)
}

function offsetAt(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, Number(p.value)]),
  )
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - Math.floor(instant / 1000) * 1000
}

/** Número positivo de 31 bits a partir de un texto (FNV-1a). */
export function reminderId(key: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) & 0x7fffffff
}
