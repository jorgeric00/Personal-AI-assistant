import { useTranslation } from 'react-i18next'

import { useDateFormat } from '../../lib/useRelativeDate'
import type { AgendaItem } from './api'
import { formatMinutes, summarize } from './schedule'

interface WeekSummaryProps {
  items: AgendaItem[]
  from: string
  to: string
}

/** Horas por categoría y plan frente a realizado de una semana. Solo con datos reales de la agenda. */
export function WeekSummary({ items, from, to }: WeekSummaryProps) {
  const { t } = useTranslation()
  const { today } = useDateFormat()
  const summary = summarize(items, from, to, today)
  const units = { h: t('agenda.summary.h'), min: t('agenda.summary.min') }
  const max = Math.max(1, ...summary.hours.map((h) => h.plannedMinutes))

  return (
    <section className="stack-sm" aria-labelledby="week-summary-title">
      <h2 id="week-summary-title" className="h2">
        {t('agenda.summary.title')}
      </h2>
      <div className="card stack">
        <div className="stack-sm">
          <h3 className="h3">{t('agenda.summary.plan')}</h3>
          {summary.due === 0 ? (
            <p className="muted">{t('agenda.summary.planEmpty')}</p>
          ) : (
            <>
              <p className="stat-value">{t('agenda.summary.doneOf', { done: summary.done, due: summary.due })}</p>
              <div
                className="category-bar-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={summary.due}
                aria-valuenow={summary.done}
                aria-label={t('agenda.summary.plan')}
              >
                <span
                  className="category-bar-fill"
                  style={{ width: `${(summary.done / summary.due) * 100}%`, background: 'var(--accent)' }}
                />
              </div>
              {(summary.missed > 0 || summary.unreviewed > 0) && (
                <p className="muted small">
                  {[
                    summary.missed > 0 && t('agenda.summary.missed', { count: summary.missed }),
                    summary.unreviewed > 0 && t('agenda.summary.unreviewed', { count: summary.unreviewed }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </>
          )}
        </div>

        <div className="stack-sm">
          <h3 className="h3">{t('agenda.summary.hours')}</h3>
          {summary.hours.length === 0 ? (
            <p className="muted">{t('agenda.summary.hoursEmpty')}</p>
          ) : (
            <ul className="list-plain stack-sm">
              {summary.hours.map(({ category, plannedMinutes, doneMinutes }) => (
                <li key={category.id} className="hours-row">
                  <span className="hours-label">
                    <span className="category-tag">
                      <span className="category-dot" style={{ background: category.color }} aria-hidden="true" />
                      {category.name}
                    </span>
                    <span className="muted small">
                      {[
                        t('agenda.summary.planned', { time: formatMinutes(plannedMinutes, units) }),
                        doneMinutes > 0 && t('agenda.summary.done', { time: formatMinutes(doneMinutes, units) }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="hours-bar" aria-hidden="true">
                    <span
                      className="hours-bar-planned"
                      style={{
                        width: `${(plannedMinutes / max) * 100}%`,
                        background: `color-mix(in srgb, ${category.color} 35%, transparent)`,
                      }}
                    >
                      <span
                        className="hours-bar-done"
                        style={{ width: `${(doneMinutes / plannedMinutes) * 100}%`, background: category.color }}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">{t('agenda.summary.hoursNote')}</p>
        </div>
      </div>
    </section>
  )
}
