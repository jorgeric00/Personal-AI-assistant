import { describe, expect, it } from 'vitest'

import { formatLongDate, greetingKey } from './date'

describe('greetingKey', () => {
  it('usa la hora de Madrid, no la del dispositivo', () => {
    // 05:30 UTC en verano = 07:30 en Madrid
    expect(greetingKey(new Date('2026-07-01T05:30:00Z'))).toBe('greeting.morning')
    // 13:30 UTC en verano = 15:30 en Madrid
    expect(greetingKey(new Date('2026-07-01T13:30:00Z'))).toBe('greeting.afternoon')
    // 20:30 UTC en invierno = 21:30 en Madrid
    expect(greetingKey(new Date('2026-01-15T20:30:00Z'))).toBe('greeting.evening')
  })

  it('respeta otra zona horaria si se indica', () => {
    expect(greetingKey(new Date('2026-07-01T05:30:00Z'), 'America/New_York')).toBe('greeting.evening')
  })
})

describe('formatLongDate', () => {
  it('formatea en español con mayúscula inicial', () => {
    expect(formatLongDate(new Date('2026-10-11T10:00:00Z'), 'es-ES')).toBe('Domingo, 11 de octubre')
  })

  it('formatea en inglés', () => {
    expect(formatLongDate(new Date('2026-10-11T10:00:00Z'), 'en-GB')).toBe('Sunday 11 October')
  })

  it('cambia de día según la zona horaria', () => {
    // 23:30 UTC del 10 de octubre ya es 11 de octubre en Madrid
    expect(formatLongDate(new Date('2026-10-10T23:30:00Z'), 'es-ES')).toBe('Domingo, 11 de octubre')
  })
})
