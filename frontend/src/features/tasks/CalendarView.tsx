import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { addDays, formatMonthYear, isoWeekday, weekdayNames } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { ChevronLeftIcon, ChevronRightIcon, RepeatIcon } from '../../ui/icons'
import { useCalendar, type CalendarEntry } from './api'

interface CalendarViewProps {
  onOpenTask: (taskId: string) => void
}

function firstOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

function shiftMonth(firstDay: string, months: number) {
  const [y, m] = firstDay.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + months, 1))
  return date.toISOString().slice(0, 10)
}

/** Calendario mensual de tareas y recordatorios (incluye las apariciones futuras de los recurrentes). */
export function CalendarView({ onOpenTask }: CalendarViewProps) {
  const { t } = useTranslation()
  const { today, locale, relativeDate } = useDateFormat()
  const [month, setMonth] = useState(() => firstOfMonth(today))
  const [selected, setSelected] = useState(today)

  // La cuadrícula empieza en el lunes anterior al día 1 y ocupa 6 semanas.
  const gridStart = addDays(month, -(isoWeekday(month) - 1))
  const gridEnd = addDays(gridStart, 41)
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart])
  const calendar = useCalendar(gridStart, gridEnd)

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    calendar.data?.forEach((entry) => map.set(entry.date, [...(map.get(entry.date) ?? []), entry]))
    return map
  }, [calendar.data])

  const selectedEntries = byDay.get(selected) ?? []
  const names = weekdayNames(locale, 'narrow')

  return (
    <div className="stack-lg">
      <div className="card calendar">
        <div className="calendar-header">
          <button
            type="button"
            className="icon-button"
            aria-label={t('tasks.calendar.previous')}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeftIcon />
          </button>
          <h2 className="h2" aria-live="polite">
            {formatMonthYear(month, locale)}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('tasks.calendar.next')}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRightIcon />
          </button>
        </div>
        <div className="calendar-grid" role="grid" aria-busy={calendar.isPending}>
          <div className="calendar-row" role="row">
            {names.map((name, i) => (
              <span key={i} className="calendar-weekday" role="columnheader">
                {name}
              </span>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, week) => (
            <div className="calendar-row" role="row" key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const entries = byDay.get(day) ?? []
                const pending = entries.filter((e) => !e.done).length
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    className={[
                      'calendar-day',
                      day.slice(0, 7) !== month.slice(0, 7) && 'is-outside',
                      day === today && 'is-today',
                      day === selected && 'is-selected',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-selected={day === selected}
                    aria-label={`${relativeDate(day)}${entries.length ? `, ${t('tasks.calendar.itemsOnDay', { count: entries.length })}` : ''}`}
                    onClick={() => setSelected(day)}
                  >
                    <span>{Number(day.slice(8))}</span>
                    {entries.length > 0 && (
                      <span className="calendar-dots" aria-hidden="true">
                        {entries.slice(0, 3).map((e, i) => (
                          <span key={i} className={`calendar-dot${e.done ? ' is-done' : ''}`} />
                        ))}
                      </span>
                    )}
                    {pending === 0 && entries.length > 0 && <span className="visually-hidden">✓</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <section className="stack" aria-labelledby="day-title">
        <h2 id="day-title" className="h2">
          {relativeDate(selected)}
        </h2>
        {selectedEntries.length === 0 ? (
          <p className="muted">{t('tasks.calendar.emptyDay')}</p>
        ) : (
          <ul className="list-plain stack-sm">
            {selectedEntries.map((entry) => (
              <li key={`${entry.taskId}-${entry.date}`}>
                <button
                  type="button"
                  className={`calendar-entry${entry.done ? ' is-done' : ''}`}
                  onClick={() => onOpenTask(entry.taskId)}
                >
                  <span className="calendar-entry-time">{entry.time?.slice(0, 5) ?? '—'}</span>
                  <span className="task-title">{entry.title}</span>
                  {entry.recurring && <RepeatIcon />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
