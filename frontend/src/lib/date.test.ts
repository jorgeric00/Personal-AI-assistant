import { describe, expect, it } from 'vitest'

import { formatLongDate, greeting } from './date'

describe('greeting', () => {
  it('usa la hora de Madrid, no la del dispositivo', () => {
    // 05:30 UTC en verano = 07:30 en Madrid
    expect(greeting(new Date('2026-07-01T05:30:00Z'))).toBe('Buenos días')
    // 13:30 UTC en verano = 15:30 en Madrid
    expect(greeting(new Date('2026-07-01T13:30:00Z'))).toBe('Buenas tardes')
    // 20:30 UTC en invierno = 21:30 en Madrid
    expect(greeting(new Date('2026-01-15T20:30:00Z'))).toBe('Buenas noches')
  })

  it('respeta otra zona horaria si se indica', () => {
    expect(greeting(new Date('2026-07-01T05:30:00Z'), 'America/New_York')).toBe('Buenas noches')
  })
})

describe('formatLongDate', () => {
  it('formatea en español con mayúscula inicial', () => {
    expect(formatLongDate(new Date('2026-10-11T10:00:00Z'))).toBe('Domingo, 11 de octubre')
  })

  it('cambia de día según la zona horaria', () => {
    // 23:30 UTC del 10 de octubre ya es 11 de octubre en Madrid
    expect(formatLongDate(new Date('2026-10-10T23:30:00Z'))).toBe('Domingo, 11 de octubre')
  })
})
