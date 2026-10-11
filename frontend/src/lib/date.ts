/** Utilidades de fecha. Toda fecha visible se calcula en la zona horaria del usuario. */

import type { ParseKeys } from 'i18next'

export const DEFAULT_TIMEZONE = 'Europe/Madrid'

function hourIn(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date)
  return Number(hour)
}

/** Clave de traducción del saludo según la hora local. */
export function greetingKey(date: Date, timeZone = DEFAULT_TIMEZONE): ParseKeys {
  const hour = hourIn(date, timeZone)
  if (hour >= 6 && hour < 14) return 'greeting.morning'
  if (hour >= 14 && hour < 21) return 'greeting.afternoon'
  return 'greeting.evening'
}

export function formatLongDate(date: Date, locale: string, timeZone = DEFAULT_TIMEZONE): string {
  const text = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
