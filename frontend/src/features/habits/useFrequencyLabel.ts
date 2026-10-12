import { useTranslation } from 'react-i18next'

import { weekdayNames } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { WEEKDAYS } from '../tasks/api'
import type { Habit } from './api'

/** «Cada día», «lun, mié, vie» o «3 veces por semana». */
export function useFrequencyLabel() {
  const { t } = useTranslation()
  const { locale } = useDateFormat()
  const names = weekdayNames(locale)
  return (habit: Habit) => {
    if (habit.frequency === 'WEEKLY') return t('habits.timesPerWeek', { count: habit.timesPerWeek ?? 1 })
    if (habit.weekdays.length === 0) return t('habits.everyDay')
    return WEEKDAYS.flatMap((day, i) => (habit.weekdays.includes(day) ? [names[i]] : [])).join(', ')
  }
}
