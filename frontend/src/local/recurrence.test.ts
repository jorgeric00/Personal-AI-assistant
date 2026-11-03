import { describe, expect, it } from 'vitest'

import { Recurrence } from './recurrence'

// Las mismas comprobaciones que RecurrenceTest.java en el servidor.
describe('repetición en la base de datos local', () => {
  it('diaria con intervalo', () => {
    const every3Days = new Recurrence('DAILY', 3, [], '2026-10-01', null)
    expect(every3Days.nextAfter('2026-10-01')).toBe('2026-10-04')
    expect(every3Days.nextAfter('2026-10-02')).toBe('2026-10-04')
    expect(every3Days.firstOnOrAfter('2026-10-07')).toBe('2026-10-07')
    expect(every3Days.firstOnOrAfter('2026-09-01')).toBe('2026-10-01')
  })

  it('semanal el día del ancla', () => {
    // 2026-10-05 es lunes
    const weekly = new Recurrence('WEEKLY', 1, [], '2026-10-05', null)
    expect(weekly.nextAfter('2026-10-05')).toBe('2026-10-12')
    expect(weekly.nextAfter('2026-10-07')).toBe('2026-10-12')
  })

  it('semanal varios días cada dos semanas', () => {
    const custom = new Recurrence('WEEKLY', 2, ['MONDAY', 'THURSDAY'], '2026-10-05', null)
    expect(custom.occurrencesBetween('2026-10-05', '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-05',
      '2026-10-08',
      '2026-10-19',
      '2026-10-22',
    ])
  })

  it('mensual conserva el día del ancla', () => {
    const monthly = new Recurrence('MONTHLY', 1, [], '2026-01-31', null)
    expect(monthly.nextAfter('2026-01-31')).toBe('2026-02-28')
    expect(monthly.nextAfter('2026-02-28')).toBe('2026-03-31')
    expect(monthly.nextAfter('2026-03-31')).toBe('2026-04-30')
  })

  it('cada tres meses', () => {
    const quarterly = new Recurrence('MONTHLY', 3, [], '2026-01-15', null)
    expect(quarterly.nextAfter('2026-01-15')).toBe('2026-04-15')
    expect(quarterly.firstOnOrAfter('2026-05-01')).toBe('2026-07-15')
  })

  it('se detiene después de la fecha de fin', () => {
    const limited = new Recurrence('DAILY', 1, [], '2026-10-01', '2026-10-03')
    expect(limited.nextAfter('2026-10-02')).toBe('2026-10-03')
    expect(limited.nextAfter('2026-10-03')).toBeNull()
    expect(limited.occurrencesBetween('2026-10-01', '2026-09-01', '2026-12-31')).toHaveLength(3)
  })

  it('los días de la semana se guardan y se leen igual', () => {
    const custom = new Recurrence('WEEKLY', 1, ['THURSDAY', 'MONDAY'], '2026-10-05', null)
    expect(Recurrence.parseWeekdays(custom.weekdaysAsString())).toEqual(['MONDAY', 'THURSDAY'])
  })
})
