import { describe, expect, it } from 'vitest'

import type { Habit } from './api'
import { completionRate, historyWeeks, isScheduled, weekProgress } from './stats'

const habit = (overrides: Partial<Habit>): Habit => ({
  id: 'h1',
  name: 'Leer',
  color: '#0f766e',
  frequency: 'DAILY',
  weekdays: [],
  timesPerWeek: null,
  startDate: '2026-09-01',
  archived: false,
  checks: [],
  ...overrides,
})

// Lunes 12 de octubre de 2026
describe('estadísticas de hábitos', () => {
  it('solo toca los días elegidos y nunca antes de crearlo', () => {
    const gym = habit({ weekdays: ['MONDAY', 'WEDNESDAY'], startDate: '2026-10-07' })
    expect(isScheduled(gym, '2026-10-12')).toBe(true)
    expect(isScheduled(gym, '2026-10-13')).toBe(false)
    expect(isScheduled(gym, '2026-10-05')).toBe(false)
  })

  it('cuenta la semana según la frecuencia', () => {
    const daily = habit({ weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], checks: ['2026-10-12', '2026-10-13'] })
    // El martes no tocaba: no suma
    expect(weekProgress(daily, '2026-10-12')).toEqual({ done: 1, expected: 3 })
    const weekly = habit({ frequency: 'WEEKLY', timesPerWeek: 3, startDate: '2026-10-16', checks: ['2026-10-17'] })
    // Creado el viernes: solo quedaban 3 días
    expect(weekProgress(weekly, '2026-10-12')).toEqual({ done: 1, expected: 3 })
    expect(weekProgress({ ...weekly, startDate: '2026-10-17' }, '2026-10-12')).toEqual({ done: 1, expected: 2 })
  })

  it('el porcentaje no cuenta días futuros ni penaliza la semana en curso de un semanal', () => {
    const daily = habit({ checks: ['2026-10-05', '2026-10-06', '2026-10-12'] })
    // Semana del 5: 2 de 7; semana del 12 hasta hoy: 1 de 1
    expect(completionRate(daily, '2026-10-05', '2026-10-12', '2026-10-12')).toBe(38)
    const weekly = habit({ frequency: 'WEEKLY', timesPerWeek: 2, checks: ['2026-10-06', '2026-10-07', '2026-10-08'] })
    // Semana del 5 cumplida (las de más no suman); la actual aún no cuenta
    expect(completionRate(weekly, '2026-10-05', '2026-10-12', '2026-10-12')).toBe(100)
    expect(completionRate(habit({ startDate: '2026-10-13' }), '2026-10-05', '2026-10-12', '2026-10-12')).toBeNull()
    // Creado hoy y aún sin marcar: no hay porcentaje todavía
    expect(completionRate(habit({ startDate: '2026-10-12' }), '2026-10-05', '2026-10-12', '2026-10-12')).toBeNull()
  })

  it('el historial acaba en la semana de hoy', () => {
    expect(historyWeeks('2026-10-14', 3)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
  })
})
