import { useTranslation } from 'react-i18next'

import { formatDateWithYear } from '../../lib/date'
import { formatDecimal } from '../../lib/decimal'

const WIDTH = 320
const HEIGHT = 170
const PADDING = { top: 12, bottom: 22, left: 36, right: 10 }

export interface MetricPoint {
  date: string
  value: number
}

const DAY = 86_400_000
const time = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

/**
 * Evolución de un valor en el tiempo. El eje horizontal respeta la separación real entre fechas para no dar
 * la impresión de un cambio regular cuando los registros son irregulares. Incluye una tabla para lectores de
 * pantalla.
 */
export function MetricChart({ points, label, unit, locale }: { points: MetricPoint[]; label: string; unit: string; locale: string }) {
  const { t } = useTranslation()
  const values = points.map((p) => p.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  // Margen vertical para que una variación pequeña no parezca enorme ni la línea toque los bordes.
  const margin = Math.max((rawMax - rawMin) * 0.15, rawMax * 0.01, 0.5)
  const min = rawMin - margin
  const max = rawMax + margin
  const first = time(points[0].date)
  const last = time(points[points.length - 1].date)
  const span = Math.max(last - first, DAY)
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const x = (iso: string) => (points.length === 1 ? PADDING.left + plotWidth / 2 : PADDING.left + ((time(iso) - first) / span) * plotWidth)
  const y = (value: number) => PADDING.top + ((max - value) / (max - min)) * plotHeight
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const format = (value: number) => formatDecimal(value, locale)

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t('fitness.chartLabel', { metric: label })}>
        {[rawMax, rawMin].map((value, i) => (
          <g key={i}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(value)} y2={y(value)} className="chart-grid" />
            <text x={PADDING.left - 6} y={y(value) + 4} textAnchor="end" className="chart-label">
              {format(value)}
            </text>
          </g>
        ))}
        <path d={path} className="chart-line" />
        {points.map((point) => (
          <circle key={point.date} cx={x(point.date)} cy={y(point.value)} r={3} className="chart-point" />
        ))}
        <text x={PADDING.left} y={HEIGHT - 6} textAnchor="start" className="chart-label">
          {formatDateWithYear(points[0].date, locale)}
        </text>
        {points.length > 1 && (
          <text x={WIDTH - PADDING.right} y={HEIGHT - 6} textAnchor="end" className="chart-label">
            {formatDateWithYear(points[points.length - 1].date, locale)}
          </text>
        )}
      </svg>
      <table className="visually-hidden">
        <thead>
          <tr>
            <th>{t('fitness.form.date')}</th>
            <th>
              {label} ({unit})
            </th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
