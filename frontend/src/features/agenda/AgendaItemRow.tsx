import { useTranslation } from 'react-i18next'

import { formatShortDate, formatTime } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { RepeatIcon } from '../../ui/icons'
import type { ActivityStatus, AgendaItem } from './api'

interface AgendaItemRowProps {
  item: AgendaItem
  /** Día en el que se muestra (una actividad de varios días aparece en cada uno). */
  day: string
  overlap: boolean
  onOpen: (item: AgendaItem) => void
  onStatus: (item: AgendaItem, status: ActivityStatus) => void
}

/** Una aparición en la agenda: hora, título, categoría, estado y avisos. */
export function AgendaItemRow({ item, day, overlap, onOpen, onStatus }: AgendaItemRowProps) {
  const { t } = useTranslation()
  const { today, locale } = useDateFormat()
  const multiDay = item.startDate !== item.endDate

  let time: string
  if (item.kind !== 'ACTIVITY') time = t('nav.fitness')
  else if (!item.startTime) time = t('agenda.allDay')
  else if (!multiDay) time = `${formatTime(item.startTime)}–${formatTime(item.endTime)}`
  else if (day === item.startDate) time = `${formatTime(item.startTime)} →`
  else if (day === item.endDate) time = `→ ${formatTime(item.endTime)}`
  else time = t('agenda.allDay')

  const meta: string[] = []
  if (multiDay) {
    meta.push(
      day === item.startDate
        ? t('agenda.untilDate', { date: formatShortDate(item.endDate, locale) })
        : t('agenda.fromDate', { date: formatShortDate(item.startDate, locale) }),
    )
  }
  if (item.kind !== 'ACTIVITY') meta.push(t(`agenda.workout.${item.status as 'PLANNED'}`))
  else if (item.status !== 'PLANNED') meta.push(t(`agenda.status.${item.status}`))
  if (item.category) meta.push(item.category.name)
  if (item.location) meta.push(item.location)

  const reviewable =
    item.kind === 'ACTIVITY' && item.date <= today && (item.status === 'PLANNED' || item.status === 'CONFIRMED')

  return (
    <li
      className={[
        'agenda-item',
        (item.status === 'CANCELLED' || item.status === 'MISSED') && 'is-off',
        item.status === 'DONE' && 'is-done',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button type="button" className="agenda-item-main" onClick={() => onOpen(item)}>
        <span
          className="agenda-item-bar"
          style={{ background: item.category?.color ?? 'var(--accent)' }}
          aria-hidden="true"
        />
        <span className="agenda-item-time">{time}</span>
        <span className="agenda-item-body">
          <span className="agenda-item-title">
            {item.title}
            {item.recurring && item.kind === 'ACTIVITY' && <RepeatIcon />}
          </span>
          {meta.length > 0 && <span className="agenda-item-meta">{meta.join(' · ')}</span>}
          {overlap && <span className="agenda-item-warning">⚠ {t('agenda.overlap')}</span>}
        </span>
      </button>
      {reviewable && (
        <div className="agenda-item-actions">
          <button
            type="button"
            className="chip"
            aria-label={t('agenda.markDoneLabel', { title: item.title })}
            onClick={() => onStatus(item, 'DONE')}
          >
            {t('agenda.markDone')}
          </button>
          <button
            type="button"
            className="chip"
            aria-label={t('agenda.markMissedLabel', { title: item.title })}
            onClick={() => onStatus(item, 'MISSED')}
          >
            {t('agenda.markMissed')}
          </button>
        </div>
      )}
    </li>
  )
}
