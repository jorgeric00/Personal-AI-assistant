import { describe, expect, it } from 'vitest'

import type { Measurement, WorkoutSummary } from '../fitness/api'
import type { PlannedMeal } from '../nutrition/api'
import type { Goal } from './api'
import { bodyProgress, exerciseProgress, mealPlanProgress, trainingProgress } from './progress'

const goal = (overrides: Partial<Goal>): Goal => ({
  id: 'g1',
  title: 'Objetivo',
  kind: 'BODY',
  metric: 'WEIGHT_KG',
  targetValue: 78,
  exerciseId: null,
  habitId: null,
  startDate: '2026-09-01',
  targetDate: null,
  notes: null,
  status: 'ACTIVE',
  achievedOn: null,
  ...overrides,
})
const empty = { notes: null, weightKg: null, bodyFatPct: null, waistCm: null, chestCm: null, hipCm: null, armCm: null, thighCm: null }
const measurement = (date: string, values: Partial<Measurement>): Measurement => ({ ...empty, id: date, date, ...values })

// Lunes 12 de octubre de 2026
describe('progreso de objetivos', () => {
  it('mide el cambio desde el valor de inicio hacia la meta, en cualquier dirección', () => {
    const data = [
      measurement('2026-08-20', { weightKg: 84 }),
      measurement('2026-08-30', { weightKg: 82, waistCm: 90 }),
      measurement('2026-10-10', { weightKg: 80 }),
    ]
    expect(bodyProgress(goal({}), data)).toEqual({ percent: 50, reached: false, current: 80, start: 82 })
    // Subir de cintura no es avanzar hacia 85: se queda en 0, sin números negativos
    expect(bodyProgress(goal({ metric: 'WAIST_CM', targetValue: 85 }), [...data, measurement('2026-10-11', { waistCm: 92 })]).percent).toBe(0)
    // Ganar masa: la meta está por encima
    expect(bodyProgress(goal({ metric: 'ARM_CM', targetValue: 36 }), [measurement('2026-10-01', { armCm: 34 }), measurement('2026-10-11', { armCm: 36.5 })])).toMatchObject({ percent: 100, reached: true })
    expect(bodyProgress(goal({ metric: 'HIP_CM' }), data).percent).toBeNull()
  })

  it('cuenta días de entreno de esta semana y semanas cumplidas desde el inicio', () => {
    const w = (date: string, finished = true): WorkoutSummary => ({ id: date, routineId: null, name: 'X', date, finished, finishedAt: null, exerciseCount: 1, doneSets: 1 })
    const workouts = [w('2026-10-12'), w('2026-10-12'), w('2026-10-06'), w('2026-10-07'), w('2026-10-08', false), w('2026-09-29'), w('2026-09-30')]
    const progress = trainingProgress(goal({ kind: 'TRAINING', targetValue: 2, startDate: '2026-09-28' }), workouts, '2026-10-12')
    expect(progress).toMatchObject({ percent: 50, reached: false, current: 1, weeksMet: { met: 2, of: 2 } })
  })

  it('usa la mejor marca del ejercicio y avisa si ya no existe', () => {
    const records = [{ exerciseId: 'e1', bestWeightKg: 60 } as never]
    expect(exerciseProgress(goal({ kind: 'EXERCISE', exerciseId: 'e1', targetValue: 80 }), records)).toMatchObject({ percent: 75, current: 60 })
    expect(exerciseProgress(goal({ kind: 'EXERCISE', exerciseId: null }), records).missing).toBe(true)
  })

  it('solo cuenta las comidas planificadas hasta hoy', () => {
    const plan = (date: string, logged: boolean) => ({ id: date, date, logged }) as PlannedMeal
    const plans = [plan('2026-10-10', true), plan('2026-10-11', false), plan('2026-10-12', true), plan('2026-10-13', false)]
    expect(mealPlanProgress(goal({ kind: 'MEAL_PLAN', targetValue: 80 }), plans, '2026-10-12')).toMatchObject({ current: 67, percent: 84, reached: false })
  })
})
