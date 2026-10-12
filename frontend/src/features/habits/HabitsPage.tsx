import { useCallback, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { ApiError } from '../../api/client'
import { addDays, formatShortDate, weekdayNames } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon } from '../../ui/icons'
import { useToast } from '../../ui/toast-context'
import { useHabits, useToggleCheck, type Habit } from './api'
import { HabitEditor } from './HabitEditor'
import { useFrequencyLabel } from './useFrequencyLabel'
import { completionRate, historyWeeks, isScheduled, mondayOf, weekProgress } from './stats'

const HISTORY_WEEKS = 12
const RATE_WEEKS = 4
const NEW = 'nuevo'

/**
 * Hábitos: marcar los días de esta semana, ver el historial de las últimas semanas y la tendencia. No hay rachas que
 * se pierdan: se muestra cuánto se ha cumplido, no cuánto se ha fallado. El formulario abierto vive en ?habito.
 */
export function HabitsPage() {
  const { t } = useTranslation()
  const { today } = useDateFormat()
  const [params, setParams] = useSearchParams()
  const weeks = historyWeeks(today, HISTORY_WEEKS)
  const monday = mondayOf(today)
  const habits = useHabits(weeks[0], addDays(monday, 6))

  const update = useCallback(
    (value: string | null) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value) next.set('habito', value)
          else next.delete('habito')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const editingParam = params.get('habito')
  const editing = editingParam && editingParam !== NEW ? habits.data?.find((h) => h.id === editingParam) : undefined
  const active = (habits.data ?? []).filter((h) => !h.archived)
  const archived = (habits.data ?? []).filter((h) => h.archived)

  return (
    <div className="page stack-lg">
      <header className="page-header page-header-row">
        <h1 className="h1">{t('habits.title')}</h1>
        <button type="button" className="button button-primary button-small" onClick={() => update(NEW)}>
          <PlusIcon />
          {t('habits.newShort')}
        </button>
      </header>

      {habits.isPending ? (
        <div className="card skeleton" aria-hidden="true" />
      ) : habits.isError ? (
        <div className="alert alert-error" role="alert">
          {habits.error instanceof ApiError ? habits.error.message : t('errors.generic')}
        </div>
      ) : active.length === 0 && archived.length === 0 ? (
        <div className="card stack-sm">
          <p>{t('habits.empty')}</p>
          <p className="muted small">{t('habits.emptyExamples')}</p>
        </div>
      ) : (
        <>
          <section className="stack-sm" aria-labelledby="habits-week-title">
            <h2 id="habits-week-title" className="h2">
              {t('habits.thisWeek')}
            </h2>
            {active.length === 0 ? (
              <p className="muted">{t('habits.allArchived')}</p>
            ) : (
              <ul className="list-plain stack-sm">
                {active.map((habit) => (
                  <HabitWeek key={habit.id} habit={habit} monday={monday} onOpen={() => update(habit.id)} />
                ))}
              </ul>
            )}
          </section>

          {active.length > 0 && (
            <section className="stack-sm" aria-labelledby="habits-history-title">
              <h2 id="habits-history-title" className="h2">
                {t('habits.history.title')}
              </h2>
              <p className="hint">{t('habits.history.help')}</p>
              <ul className="list-plain stack-sm">
                {active.map((habit) => (
                  <HabitHistory key={habit.id} habit={habit} weeks={weeks} />
                ))}
              </ul>
            </section>
          )}

          {archived.length > 0 && (
            <details className="card">
              <summary>{t('habits.archived', { count: archived.length })}</summary>
              <ul className="list-plain stack-sm archived-habits">
                {archived.map((habit) => (
                  <li key={habit.id}>
                    <button type="button" className="link-button" onClick={() => update(habit.id)}>
                      {habit.name}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {(editingParam === NEW || editing) && (
        <HabitEditor key={editingParam} habit={editing ?? null} onClose={() => update(null)} />
      )}
    </div>
  )
}

/** Los siete días de la semana: se marcan tocándolos (hoy y días pasados). */
function HabitWeek({ habit, monday, onOpen }: { habit: Habit; monday: string; onOpen: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale, today } = useDateFormat()
  const frequencyLabel = useFrequencyLabel()
  const toggle = useToggleCheck()
  const names = weekdayNames(locale, 'narrow')
  const progress = weekProgress(habit, monday)
  const checks = new Set(habit.checks)

  return (
    <li className="card stack-sm habit-week" style={{ '--habit-color': habit.color } as CSSProperties}>
      <div className="section-header">
        <button type="button" className="habit-name" onClick={onOpen}>
          <span className="habit-dot" aria-hidden="true" />
          <span>
            <span className="food-name">{habit.name}</span>
            <span className="food-meta">{frequencyLabel(habit)}</span>
          </span>
        </button>
        {progress.expected > 0 && (
          <span className="habit-progress">
            {t('habits.progress', { done: progress.done, expected: progress.expected })}
          </span>
        )}
      </div>
      <div className="habit-days" role="group" aria-label={t('habits.daysLabel', { name: habit.name })}>
        {names.map((letter, i) => {
          const date = addDays(monday, i)
          const done = checks.has(date)
          const future = date > today
          const scheduled = isScheduled(habit, date)
          return (
            <button
              key={date}
              type="button"
              className={`habit-day${done ? ' is-done' : ''}${scheduled ? '' : ' is-off'}${date === today ? ' is-today' : ''}`}
              aria-pressed={done}
              aria-label={t('habits.dayLabel', { name: habit.name, date: formatShortDate(date, locale) })}
              disabled={future || date < habit.startDate}
              onClick={() =>
                toggle.mutate(
                  { id: habit.id, date, done: !done },
                  { onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }) },
                )
              }
            >
              {letter}
            </button>
          )
        })}
      </div>
    </li>
  )
}

/** Últimas semanas en cuadrícula (una columna por semana) y el porcentaje de las últimas 4 frente a las 4 anteriores. */
function HabitHistory({ habit, weeks }: { habit: Habit; weeks: string[] }) {
  const { t } = useTranslation()
  const { today } = useDateFormat()
  const checks = new Set(habit.checks)
  const last = weeks.slice(-RATE_WEEKS)
  const previous = weeks.slice(-2 * RATE_WEEKS, -RATE_WEEKS)
  const rate = completionRate(habit, last[0], last[last.length - 1], today)
  const previousRate = completionRate(habit, previous[0], previous[previous.length - 1], today)
  const doneDays = habit.checks.filter((d) => d >= weeks[0]).length
  // Solo las semanas desde que existe el hábito: no se dibujan semanas vacías que nunca pudieron cumplirse
  const shown = weeks.filter((monday) => addDays(monday, 6) >= habit.startDate)

  return (
    <li className="card stack-sm" style={{ '--habit-color': habit.color } as CSSProperties}>
      <div className="section-header">
        <span className="food-name">{habit.name}</span>
        {rate != null && <span className="habit-progress">{t('habits.history.rate', { value: rate })}</span>}
      </div>
      <div
        className="habit-grid"
        role="img"
        aria-label={t('habits.history.gridLabel', { name: habit.name, count: doneDays, weeks: weeks.length })}
      >
        {shown.map((monday) => (
          <span key={monday} className="habit-grid-week">
            {Array.from({ length: 7 }, (_, i) => {
              const date = addDays(monday, i)
              const state =
                date < habit.startDate
                  ? 'is-empty'
                  : date > today
                    ? 'is-future'
                    : checks.has(date)
                      ? 'is-done'
                      : isScheduled(habit, date) && habit.frequency === 'DAILY'
                        ? 'is-missed'
                        : 'is-off'
              return <span key={date} className={`habit-cell ${state}`} />
            })}
          </span>
        ))}
      </div>
      <p className="muted small">
        {t('habits.history.days', { count: doneDays, weeks: weeks.length })}
        {rate != null && previousRate != null && ` · ${t('habits.history.previous', { value: previousRate })}`}
      </p>
    </li>
  )
}
