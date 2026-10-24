import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'
import type { Metric } from '../fitness/api'

export type ReportPeriod = 'WEEK' | 'MONTH'

export interface HabitSummary {
  id: string
  name: string
  color: string
  frequency: 'DAILY' | 'WEEKLY'
  timesPerWeek: number | null
  done: number
  /** Días que tocaban; null en los semanales. */
  expected: number | null
  previousDone: number
  previousExpected: number | null
}

export interface BodyChange {
  metric: Metric
  firstDate: string
  first: number
  lastDate: string
  last: number
  count: number
}

export interface Report {
  period: ReportPeriod
  start: string
  end: string
  /** Último día contado: hoy si el periodo está en curso. */
  to: string
  partial: boolean
  previousFrom: string
  previousTo: string
  tasks: { completed: number; previousCompleted: number }
  finance: {
    currency: string | null
    incomeCents: number
    expenseCents: number
    previousIncomeCents: number
    previousExpenseCents: number
    topExpenses: { id: string; name: string; color: string; amountCents: number }[]
  }
  training: { workouts: number; previousWorkouts: number; setsDone: number; previousSetsDone: number }
  nutrition: {
    loggedDays: number
    previousLoggedDays: number
    averageCalories: number | null
    previousAverageCalories: number | null
    estimated: boolean
  }
  habits: HabitSummary[]
  body: BodyChange[]
}

export function useReport(period: ReportPeriod, date: string) {
  return useQuery({
    queryKey: ['reports', period, date],
    queryFn: () => apiFetch<Report>(`/api/reports?period=${period}&date=${date}`),
  })
}
