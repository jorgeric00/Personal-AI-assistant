/** Utilidades de fecha. Toda fecha visible se calcula en la zona horaria del usuario. */

export const DEFAULT_TIMEZONE = 'Europe/Madrid'

function hourIn(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('es-ES', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date)
  return Number(hour)
}

export function greeting(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const hour = hourIn(date, timeZone)
  if (hour >= 6 && hour < 14) return 'Buenos días'
  if (hour >= 14 && hour < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

export function formatLongDate(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const text = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
