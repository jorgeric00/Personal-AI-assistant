import { addDays } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { useMeasurements, useRecords, useWorkouts } from '../fitness/api'
import { useHabits } from '../habits/api'
import { historyWeeks, mondayOf } from '../habits/stats'
import { usePlan } from '../nutrition/api'
import type { Goal } from './api'
import {
  bodyProgress,
  exerciseProgress,
  habitProgress,
  mealPlanProgress,
  trainingProgress,
  type GoalProgress,
} from './progress'

/** Carga solo los registros que necesitan los objetivos activos y devuelve cómo calcular el progreso de cada uno. */
export function useGoalProgress(goals: Goal[]) {
  const { today } = useDateFormat()
  const kinds = new Set(goals.map((g) => g.kind))
  const measurements = useMeasurements(kinds.has('BODY'))
  const workouts = useWorkouts(kinds.has('TRAINING'))
  const records = useRecords(kinds.has('EXERCISE'))
  const habits = useHabits(historyWeeks(today, 4)[0], addDays(mondayOf(today), 6), kinds.has('HABIT'))
  const plans = usePlan(addDays(today, -27), today, kinds.has('MEAL_PLAN'))

  return (goal: Goal): GoalProgress | null => {
    switch (goal.kind) {
      case 'BODY':
        return measurements.data ? bodyProgress(goal, measurements.data) : null
      case 'TRAINING':
        return workouts.data ? trainingProgress(goal, workouts.data, today) : null
      case 'EXERCISE':
        return records.data ? exerciseProgress(goal, records.data) : null
      case 'HABIT':
        return habits.data ? habitProgress(goal, habits.data, today) : null
      case 'MEAL_PLAN':
        return plans.data ? mealPlanProgress(goal, plans.data, today) : null
      default:
        return null
    }
  }
}
