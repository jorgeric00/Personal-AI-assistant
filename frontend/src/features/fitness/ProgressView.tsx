import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { addDays, formatDateWithYear } from '../../lib/date'
import { formatDecimal } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon } from '../../ui/icons'
import { useCustomMetrics, useMeasurements, type Measurement } from './api'
import { MetricChart } from './MetricChart'
import { buildSeries, withUnit, type Series } from './series'

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
  onManage: () => void
}

/**
 * Evolución física: último valor de cada medida (y de cada indicador propio) y su cambio desde la fecha elegida,
 * gráfico por medida y periodo, e historial de registros. Solo muestra lo registrado; no rellena huecos ni saca
 * conclusiones.
 */
export function ProgressView({ onAdd, onOpen, onManage }: ProgressViewProps) {
  const { t } = useTranslation()
  const { locale, today } = useDateFormat()
  const measurements = useMeasurements()
  const customMetrics = useCustomMetrics()
  const [compareFrom, setCompareFrom] = useState<string | null>(null)
  const [metric, setMetric] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('6M')

  if (measurements.isPending || customMetrics.isPending) {
    return (
      <div className="screen-center-inline" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    )
  }
  const failed = measurements.error ?? customMetrics.error
  if (failed) {
    return (
      <div className="alert alert-error" role="alert">
        {failed.message}
      </div>
    )
  }

  const manage = (
    <button type="button" className="button button-secondary button-small" onClick={onManage}>
      {t('fitness.custom.manage')}
    </button>
  )

  const entries = measurements.data
  const ownMetrics = customMetrics.data
  if (!entries || !ownMetrics) return null
  if (entries.length === 0) {
    return (
      <div className="card empty-state stack">
        <p className="muted">{t('fitness.empty')}</p>
        <button type="button" className="button button-primary" onClick={onAdd}>
          <PlusIcon />
          {t('fitness.addEntry')}
        </button>
        {manage}
      </div>
    )
  }

  // Cronológico (el servidor los da del más reciente al más antiguo).
  const chronological = [...entries].reverse()
  const series = buildSeries(t, ownMetrics)
  const tracked = series.filter((s) => entries.some((e) => s.value(e) !== null))
  const dates = chronological.map((e) => e.date)
  const from = compareFrom && dates.includes(compareFrom) ? compareFrom : dates[0]
  const selected = tracked.find((s) => s.key === metric) ?? tracked[0] ?? null
  const days = PERIODS.find((p) => p.value === period)?.days
  const since = days ? addDays(today, -days) : null
  const points = selected
    ? chronological
        .filter((e) => selected.value(e) !== null && (!since || e.date >= since))
        .map((e) => ({ date: e.date, value: selected.value(e) as number }))
    : []

  return (
    <div className="stack-lg">
      <div className="progress-actions">{manage}</div>

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
            {tracked.map((s) => (
              <MetricTile key={s.key} series={s} entries={chronological} from={from} locale={locale} />
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
            {tracked.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={selected.key === s.key}
                className="chip"
                onClick={() => setMetric(s.key)}
              >
                {s.label}
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
            <MetricChart points={points} label={selected.label} unit={selected.unit} locale={locale} />
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
                    {series
                      .filter((s) => s.value(entry) !== null)
                      .map((s) => `${s.short} ${withUnit(formatDecimal(s.value(entry) as number, locale, 2), s.unit)}`)
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

/** Último valor de una serie y diferencia con el primer valor registrado desde la fecha de comparación. */
function MetricTile({ series, entries, from, locale }: { series: Series; entries: Measurement[]; from: string; locale: string }) {
  const { t } = useTranslation()
  const withValue = entries.filter((e) => series.value(e) !== null)
  const latest = withValue[withValue.length - 1]
  const base = withValue.find((e) => e.date >= from)
  const latestValue = series.value(latest) as number
  const diff = base && base.date < latest.date ? latestValue - (series.value(base) as number) : null
  return (
    <li className="metric-tile">
      <span className="stat-label">{series.label}</span>
      <span className="metric-value">
        {formatDecimal(latestValue, locale, 2)} {series.unit && <span className="metric-unit">{series.unit}</span>}
      </span>
      <span className="metric-diff">
        {diff === null
          ? formatDateWithYear(latest.date, locale)
          : t('fitness.diff', {
              value: withUnit(formatDecimal(diff, locale, 2, true), series.unit),
              date: formatDateWithYear(base!.date, locale),
            })}
      </span>
    </li>
  )
}
