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

/** Fecha ISO (AAAA-MM-DD) de hoy en la zona horaria indicada. */
export function todayIso(timeZone = DEFAULT_TIMEZONE, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Suma días a una fecha ISO sin depender de la zona horaria del dispositivo. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** Diferencia en días entre dos fechas ISO (b - a). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

function isoToUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

/** Fecha corta y legible: «lun, 13 oct». Se formatea en UTC porque la fecha ISO ya es local. */
export function formatShortDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    isoToUtcDate(iso),
  )
}

/** Fecha con año y sin día de la semana: «1 sept 2026». */
export function formatDateWithYear(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    isoToUtcDate(iso),
  )
}

/** «Octubre de 2026». Con capitalize false se deja como lo da Intl, para usarlo dentro de una frase. */
export function formatMonthYear(iso: string, locale: string, capitalize = true): string {
  const text = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    isoToUtcDate(iso),
  )
  return capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

/** «09:30:00» → «09:30». */
export function formatTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : ''
}

/** Día de la semana ISO (1 = lunes … 7 = domingo). */
export function isoWeekday(iso: string): number {
  const day = isoToUtcDate(iso).getUTCDay()
  return day === 0 ? 7 : day
}

/** Nombres cortos de los días de la semana empezando en lunes. */
export function weekdayNames(locale: string, style: 'narrow' | 'short' = 'short'): string[] {
  // 2024-01-01 fue lunes
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i, 12))),
  )
}

/** Instante (ISO con zona) como «11 oct 2026, 12:30» en la zona del usuario. */
export function formatInstant(instant: string, locale: string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant))
}

/** Hora «12:30» de un instante en la zona del usuario. */
export function formatInstantTime(instant: string, locale: string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(instant))
}
