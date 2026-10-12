import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ApiError } from '../../api/client'
import { addDays } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { CheckIcon } from '../../ui/icons'
import { useToast } from '../../ui/toast-context'
import { useHabits, useToggleCheck } from './api'
import { isScheduled, mondayOf, weekProgress } from './stats'

/** En Hoy: los hábitos que tocan hoy (y los semanales aún sin completar) para marcarlos con un toque. */
export function TodayHabits() {
  const { t } = useTranslation()
  const toast = useToast()
  const { today } = useDateFormat()
  const monday = mondayOf(today)
  const habits = useHabits(monday, addDays(monday, 6))
  const toggle = useToggleCheck()

  const items = (habits.data ?? [])
    .filter((h) => !h.archived && isScheduled(h, today))
    .map((habit) => ({ habit, done: habit.checks.includes(today), week: weekProgress(habit, monday) }))
    .filter(({ habit, done, week }) => habit.frequency === 'DAILY' || done || week.done < week.expected)
  if (items.length === 0) return null

  return (
    <section aria-labelledby="today-habits-title" className="stack-sm">
      <div className="section-header">
        <h2 id="today-habits-title" className="h2">
          {t('habits.title')}
        </h2>
        <Link to="/habitos" className="link">
          {t('common.seeAll')}
        </Link>
      </div>
      <ul className="card list-plain today-habits">
        {items.map(({ habit, done, week }) => (
          <li key={habit.id} style={{ '--habit-color': habit.color } as CSSProperties}>
            <button
              type="button"
              className={`habit-check${done ? ' is-done' : ''}`}
              aria-pressed={done}
              aria-label={t('habits.checkToday', { name: habit.name })}
              onClick={() =>
                toggle.mutate(
                  { id: habit.id, date: today, done: !done },
                  { onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }) },
                )
              }
            >
              {done && <CheckIcon />}
            </button>
            <span className="today-habit-text">
              <span className="food-name">{habit.name}</span>
              {habit.frequency === 'WEEKLY' && (
                <span className="food-meta">{t('habits.progress', { done: week.done, expected: week.expected })}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
