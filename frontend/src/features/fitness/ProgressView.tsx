import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { addDays, formatDateWithYear } from '../../lib/date'
import { formatDecimal } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon } from '../../ui/icons'
import { METRIC_UNITS, METRICS, useMeasurements, type Measurement, type Metric } from './api'
import { MetricChart } from './MetricChart'

type Period = '3M' | '6M' | '1Y' | 'ALL'
const PERIODS: { value: Period; days: number | null }[] = [
  { value: '3M', days: 91 },
  { value: '6M', days: 183 },
  { value: '1Y', days: 365 },
  { value: 'ALL', days: null },
]

interface ProgressViewProps {
  onAdd: () => void
  onOpen: (id: string) => void
}

/**
 * Evolución física: último valor de cada medida y su cambio desde la fecha elegida, gráfico por medida y
 * periodo, e historial de registros. Solo muestra lo registrado; no rellena huecos ni saca conclusiones.
 */
export function ProgressView({ onAdd, onOpen }: ProgressViewProps) {
  const { t } = useTranslation()
  const { locale, today } = useDateFormat()
  const measurements = useMeasurements()
  const [compareFrom, setCompareFrom] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric | null>(null)
  const [period, setPeriod] = useState<Period>('6M')

  if (measurements.isPending) {
    return (
      <div className="screen-center-inline" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    )
  }
  if (measurements.isError) {
    return (
      <div className="alert alert-error" role="alert">
        {measurements.error.message}
      </div>
    )
  }

  const entries = measurements.data
  if (entries.length === 0) {
    return (
      <div className="card empty-state stack">
        <p className="muted">{t('fitness.empty')}</p>
        <button type="button" className="button button-primary" onClick={onAdd}>
          <PlusIcon />
          {t('fitness.addEntry')}
        </button>
      </div>
    )
  }

  // Cronológico (el servidor los da del más reciente al más antiguo).
  const chronological = [...entries].reverse()
  const tracked = METRICS.filter((m) => entries.some((e) => e[m] !== null))
  const dates = chronological.map((e) => e.date)
  const from = compareFrom && dates.includes(compareFrom) ? compareFrom : dates[0]
  const selected = metric && tracked.includes(metric) ? metric : (tracked[0] ?? null)
  const days = PERIODS.find((p) => p.value === period)?.days
  const since = days ? addDays(today, -days) : null
  const points = selected
    ? chronological
        .filter((e) => e[selected] !== null && (!since || e.date >= since))
        .map((e) => ({ date: e.date, value: e[selected] as number }))
    : []

  return (
    <div className="stack-lg">
      {tracked.length > 0 && (
        <section className="card stack" aria-labelledby="latest-title">
          <h2 id="latest-title" className="h3">
            {t('fitness.latest')}
          </h2>
          {dates.length > 1 && (
            <label className="filter">
              <span className="visually-hidden">{t('fitness.compareFrom')}</span>
              <select value={from} onChange={(e) => setCompareFrom(e.target.value)}>
                {dates.slice(0, -1).map((date) => (
                  <option key={date} value={date}>
                    {t('fitness.changesSince', { date: formatDateWithYear(date, locale) })}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ul className="list-plain metric-tiles">
            {tracked.map((m) => (
              <MetricTile key={m} metric={m} entries={chronological} from={from} locale={locale} />
            ))}
          </ul>
        </section>
      )}

      {selected && (
        <section className="card stack" aria-labelledby="chart-title">
          <h2 id="chart-title" className="h3">
            {t('fitness.evolution')}
          </h2>
          <div className="chips chips-scroll" role="radiogroup" aria-label={t('fitness.metric')}>
            {tracked.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={selected === m}
                className="chip"
                onClick={() => setMetric(m)}
              >
                {t(`fitness.metrics.${m}`)}
              </button>
            ))}
          </div>
          <div className="segmented segmented-4" role="radiogroup" aria-label={t('fitness.period')}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={period === p.value}
                className="segmented-option"
                onClick={() => setPeriod(p.value)}
              >
                {t(`fitness.periods.${p.value}`)}
              </button>
            ))}
          </div>
          {points.length > 0 ? (
            <MetricChart points={points} label={t(`fitness.metrics.${selected}`)} unit={METRIC_UNITS[selected]} locale={locale} />
          ) : (
            <p className="muted">{t('fitness.noDataPeriod')}</p>
          )}
        </section>
      )}

      <section className="stack-sm" aria-labelledby="history-title">
        <h2 id="history-title" className="h2">
          {t('fitness.history')}
        </h2>
        <ul className="card list-plain movement-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="movement-row" onClick={() => onOpen(entry.id)}>
                <span className="movement-main">
                  <span className="movement-title">{formatDateWithYear(entry.date, locale)}</span>
                  <span className="movement-meta">
                    {METRICS.filter((m) => entry[m] !== null)
                      .map((m) => `${t(`fitness.metricsShort.${m}`)} ${formatDecimal(entry[m] as number, locale, 2)} ${METRIC_UNITS[m]}`)
                      .join(' · ')}
                  </span>
                  {entry.notes && <span className="movement-meta entry-notes">{entry.notes}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Último valor de una medida y diferencia con el primer valor registrado desde la fecha de comparación. */
function MetricTile({ metric, entries, from, locale }: { metric: Metric; entries: Measurement[]; from: string; locale: string }) {
  const { t } = useTranslation()
  const withValue = entries.filter((e) => e[metric] !== null)
  const latest = withValue[withValue.length - 1]
  const base = withValue.find((e) => e.date >= from)
  const unit = METRIC_UNITS[metric]
  const diff = base && base.date < latest.date ? (latest[metric] as number) - (base[metric] as number) : null
  return (
    <li className="metric-tile">
      <span className="stat-label">{t(`fitness.metrics.${metric}`)}</span>
      <span className="metric-value">
        {formatDecimal(latest[metric] as number, locale, 2)} <span className="metric-unit">{unit}</span>
      </span>
      <span className="metric-diff">
        {diff === null
          ? formatDateWithYear(latest.date, locale)
          : t('fitness.diff', { value: `${formatDecimal(diff, locale, 2, true)} ${unit}`, date: formatDateWithYear(base!.date, locale) })}
      </span>
    </li>
  )
}
