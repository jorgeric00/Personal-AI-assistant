import type { ParseKeys } from 'i18next'
import { useCallback, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'

import { ApiError } from '../../api/client'
import { addDays, formatMonthYear, formatShortDate, isoWeekday, weekdayNames } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../ui/icons'
import { useToast } from '../../ui/toast-context'
import { ActivityEditor } from './ActivityEditor'
import { AgendaCategoriesView } from './AgendaCategoriesView'
import { AgendaItemRow } from './AgendaItemRow'
import { useActivity, useAgenda, useSetStatus, type ActivityStatus, type AgendaItem } from './api'
import { coversDay, findOverlaps, itemKey } from './schedule'
import { WeekSummary } from './WeekSummary'

type View = 'DAY' | 'WEEK' | 'MONTH' | 'CATEGORIES'

const VIEWS: { value: View; label: ParseKeys }[] = [
  { value: 'DAY', label: 'agenda.views.DAY' },
  { value: 'WEEK', label: 'agenda.views.WEEK' },
  { value: 'MONTH', label: 'agenda.views.MONTH' },
  { value: 'CATEGORIES', label: 'agenda.views.CATEGORIES' },
]

const NEW = 'nueva'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function mondayOf(day: string) {
  return addDays(day, -(isoWeekday(day) - 1))
}

function shiftMonth(day: string, months: number) {
  const [y, m] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10)
}

function rangeOf(view: View, day: string): [string, string] {
  if (view === 'DAY') return [day, day]
  if (view === 'WEEK') return [mondayOf(day), addDays(mondayOf(day), 6)]
  // Cuadrícula mensual: del lunes anterior al día 1, seis semanas
  const start = mondayOf(`${day.slice(0, 7)}-01`)
  return [start, addDays(start, 41)]
}

/**
 * Agenda de actividades con vistas de día, semana y mes. El estado vive en la URL (?vista, ?fecha, ?actividad,
 * ?dia) para que el acceso rápido de Hoy abra directamente el formulario.
 */
export function AgendaPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { today, locale, relativeDate } = useDateFormat()
  const [params, setParams] = useSearchParams()
  const view = VIEWS.find((v) => v.value === params.get('vista'))?.value ?? 'WEEK'
  const dateParam = params.get('fecha')
  const day = dateParam && ISO_DATE.test(dateParam) ? dateParam : today
  const [from, to] = rangeOf(view, day)
  const agenda = useAgenda(from, to, view !== 'CATEGORIES')
  const setStatus = useSetStatus()

  const activityParam = params.get('actividad')
  const occurrenceParam = params.get('dia')
  const activity = useActivity(activityParam && activityParam !== NEW ? activityParam : null)

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const items = useMemo(() => agenda.data ?? [], [agenda.data])
  const overlaps = useMemo(() => findOverlaps(items), [items])

  const shift = (direction: 1 | -1) => {
    const next =
      view === 'DAY'
        ? addDays(day, direction)
        : view === 'WEEK'
          ? addDays(day, 7 * direction)
          : shiftMonth(day, direction)
    update({ fecha: next === today ? null : next })
  }

  const open = (item: AgendaItem) => {
    if (item.kind === 'ACTIVITY') update({ actividad: item.id, dia: item.date })
    else if (item.kind === 'WORKOUT') navigate(`/entreno/sesion/${item.id}`)
    else navigate('/entreno')
  }

  const changeStatus = (item: AgendaItem, status: ActivityStatus) =>
    setStatus.mutate(
      { id: item.id, date: item.date, status },
      {
        onSuccess: () => toast(t('agenda.statusSaved', { status: t(`agenda.status.${status}`) })),
        onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
      },
    )

  const dayList = (date: string, emptyText = true) => {
    const list = items.filter((item) => coversDay(item, date))
    if (list.length === 0) return emptyText ? <p className="muted">{t('agenda.emptyDay')}</p> : null
    return (
      <ul className="card list-plain agenda-list">
        {list.map((item) => (
          <AgendaItemRow
            key={itemKey(item)}
            item={item}
            day={date}
            overlap={overlaps.has(itemKey(item))}
            onOpen={open}
            onStatus={changeStatus}
          />
        ))}
      </ul>
    )
  }

  const title =
    view === 'DAY'
      ? relativeDate(day)
      : view === 'WEEK'
        ? `${formatShortDate(from, locale)} – ${formatShortDate(to, locale)}`
        : formatMonthYear(day, locale)
  const dayHeading = (date: string) => {
    const relative = relativeDate(date)
    const short = formatShortDate(date, locale)
    return relative === short ? short : `${relative} · ${short}`
  }
  const showsToday = today >= from && today <= to && (view !== 'MONTH' || day.slice(0, 7) === today.slice(0, 7))

  return (
    <div className="page stack-lg">
      <header className="page-header page-header-row">
        <h1 className="h1">{t('agenda.title')}</h1>
        <button
          type="button"
          className="button button-primary button-small"
          onClick={() => update({ actividad: NEW, dia: null })}
        >
          <PlusIcon />
          {t('agenda.newShort')}
        </button>
      </header>

      <nav className="tabs" aria-label={t('agenda.viewsLabel')}>
        {VIEWS.map((item) => (
          <button
            key={item.value}
            type="button"
            className="tab"
            aria-current={view === item.value ? 'page' : undefined}
            onClick={() => update({ vista: item.value === 'WEEK' ? null : item.value })}
          >
            {t(item.label)}
          </button>
        ))}
      </nav>

      {view === 'CATEGORIES' ? (
        <AgendaCategoriesView />
      ) : (
        <>
          <div className="agenda-nav">
            <button type="button" className="icon-button" aria-label={t('agenda.previous')} onClick={() => shift(-1)}>
              <ChevronLeftIcon />
            </button>
            <h2 className="h2" aria-live="polite">
              {title}
            </h2>
            <button type="button" className="icon-button" aria-label={t('agenda.next')} onClick={() => shift(1)}>
              <ChevronRightIcon />
            </button>
            {!showsToday && (
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => update({ fecha: null })}
              >
                {t('agenda.goToday')}
              </button>
            )}
          </div>

          {agenda.isPending ? (
            <div className="card skeleton" aria-hidden="true" />
          ) : agenda.isError ? (
            <div className="alert alert-error" role="alert">
              {agenda.error instanceof ApiError ? agenda.error.message : t('errors.generic')}
            </div>
          ) : view === 'DAY' ? (
            dayList(day)
          ) : view === 'WEEK' ? (
            <>
              {items.length === 0 ? (
                <p className="card muted">{t('agenda.emptyWeek')}</p>
              ) : (
                <div className="stack">
                  {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((date) => (
                    <section key={date} className="stack-sm" aria-labelledby={`day-${date}`}>
                      <h3 id={`day-${date}`} className={`h3 agenda-day-title${date === today ? ' is-today' : ''}`}>
                        {dayHeading(date)}
                      </h3>
                      {dayList(date)}
                    </section>
                  ))}
                </div>
              )}
              <WeekSummary items={items} from={from} to={to} />
            </>
          ) : (
            <MonthGrid
              selected={day}
              from={from}
              items={items}
              onSelect={(date) => update({ fecha: date === today ? null : date })}
              list={dayList(day)}
            />
          )}
        </>
      )}

      {activityParam === NEW && (
        <ActivityEditor key="new" activity={null} date={day} onClose={() => update({ actividad: null, dia: null })} />
      )}
      {activity.data && activityParam === activity.data.id && (
        <ActivityEditor
          key={`${activity.data.id}-${occurrenceParam}`}
          activity={activity.data}
          date={occurrenceParam && ISO_DATE.test(occurrenceParam) ? occurrenceParam : activity.data.startDate}
          onClose={() => update({ actividad: null, dia: null })}
        />
      )}
    </div>
  )
}

interface MonthGridProps {
  selected: string
  from: string
  items: AgendaItem[]
  onSelect: (date: string) => void
  list: ReactNode
}

/** Cuadrícula mensual con un punto por elemento (del color de su categoría) y la lista del día elegido. */
function MonthGrid({ selected, from, items, onSelect, list }: MonthGridProps) {
  const { t } = useTranslation()
  const { today, locale, relativeDate } = useDateFormat()
  const names = weekdayNames(locale, 'narrow')
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i))

  return (
    <div className="stack-lg">
      <div className="card calendar">
        <div className="calendar-grid" role="grid">
          <div className="calendar-row" role="row">
            {names.map((name, i) => (
              <span key={i} className="calendar-weekday" role="columnheader">
                {name}
              </span>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, week) => (
            <div className="calendar-row" role="row" key={week}>
              {days.slice(week * 7, week * 7 + 7).map((date) => {
                const entries = items.filter((item) => coversDay(item, date) && item.status !== 'CANCELLED')
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    className={[
                      'calendar-day',
                      date.slice(0, 7) !== selected.slice(0, 7) && 'is-outside',
                      date === today && 'is-today',
                      date === selected && 'is-selected',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-selected={date === selected}
                    aria-label={`${relativeDate(date)}${entries.length ? `, ${t('agenda.itemsOnDay', { count: entries.length })}` : ''}`}
                    onClick={() => onSelect(date)}
                  >
                    <span>{Number(date.slice(8))}</span>
                    {entries.length > 0 && (
                      <span className="calendar-dots" aria-hidden="true">
                        {entries.slice(0, 3).map((e, i) => (
                          <span
                            key={i}
                            className={`calendar-dot${e.status === 'DONE' ? ' is-done' : ''}`}
                            style={{ background: e.category?.color ?? 'var(--accent)' }}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <section className="stack-sm" aria-labelledby="month-day-title">
        <h2 id="month-day-title" className="h2">
          {relativeDate(selected)}
        </h2>
        {list}
      </section>
    </div>
  )
}
