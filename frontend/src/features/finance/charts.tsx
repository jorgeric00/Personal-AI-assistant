import { useTranslation } from 'react-i18next'

import { formatMoney } from '../../lib/money'
import type { CategoryTotal, TrendPoint } from './api'

/** Barras horizontales por categoría, de mayor a menor. */
export function CategoryBars({
  items,
  currency,
  locale,
  onSelect,
}: {
  items: CategoryTotal[]
  currency: string
  locale: string
  onSelect?: (categoryId: string) => void
}) {
  const total = items.reduce((sum, item) => sum + item.amountCents, 0)
  const max = Math.max(...items.map((item) => item.amountCents), 1)
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })
  return (
    <ul className="category-bars list-plain">
      {items.map((item) => (
        <li key={item.categoryId}>
          <button type="button" className="category-bar" onClick={() => onSelect?.(item.categoryId)}>
            <span className="category-bar-head">
              <span className="category-tag">
                <span className="category-dot" style={{ background: item.color }} aria-hidden="true" />
                {item.name}
              </span>
              <span className="category-bar-amount">
                {formatMoney(item.amountCents, currency, locale)}
                <span className="muted"> · {percent.format(total ? item.amountCents / total : 0)}</span>
              </span>
            </span>
            <span className="category-bar-track" aria-hidden="true">
              <span
                className="category-bar-fill"
                style={{ width: `${(item.amountCents / max) * 100}%`, background: item.color }}
              />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function monthLabel(month: string, locale: string) {
  const [y, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)))
}

const WIDTH = 320
const HEIGHT = 160
const PADDING = { top: 8, bottom: 22, left: 4, right: 4 }

/** Ingresos y gastos por mes (barras agrupadas). Incluye una tabla oculta para lectores de pantalla. */
export function IncomeExpenseChart({ points, currency, locale }: { points: TrendPoint[]; currency: string; locale: string }) {
  const { t } = useTranslation()
  const max = Math.max(...points.flatMap((p) => [p.incomeCents, p.expenseCents]), 1)
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const slot = (WIDTH - PADDING.left - PADDING.right) / points.length
  const barWidth = Math.min(14, slot / 3)

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t('finance.charts.incomeExpense')}>
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={HEIGHT - PADDING.bottom}
          y2={HEIGHT - PADDING.bottom}
          className="chart-axis"
        />
        {points.map((point, index) => {
          const center = PADDING.left + slot * index + slot / 2
          const income = (point.incomeCents / max) * plotHeight
          const expense = (point.expenseCents / max) * plotHeight
          return (
            <g key={point.month}>
              <rect
                className="chart-income"
                x={center - barWidth - 1}
                y={HEIGHT - PADDING.bottom - income}
                width={barWidth}
                height={income}
                rx={2}
              />
              <rect
                className="chart-expense"
                x={center + 1}
                y={HEIGHT - PADDING.bottom - expense}
                width={barWidth}
                height={expense}
                rx={2}
              />
              <text x={center} y={HEIGHT - 6} textAnchor="middle" className="chart-label">
                {monthLabel(point.month, locale)}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="chart-legend">
        <span>
          <span className="legend-swatch chart-income-bg" aria-hidden="true" /> {t('finance.income')}
        </span>
        <span>
          <span className="legend-swatch chart-expense-bg" aria-hidden="true" /> {t('finance.expenses')}
        </span>
      </figcaption>
      <table className="visually-hidden">
        <thead>
          <tr>
            <th>{t('finance.month')}</th>
            <th>{t('finance.income')}</th>
            <th>{t('finance.expenses')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.month}>
              <td>{point.month}</td>
              <td>{formatMoney(point.incomeCents, currency, locale)}</td>
              <td>{formatMoney(point.expenseCents, currency, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Ahorro acumulado mes a mes (línea). */
export function SavingsChart({ points, currency, locale }: { points: TrendPoint[]; currency: string; locale: string }) {
  const { t } = useTranslation()
  const values = points.map((p) => p.savingsCents)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values, 1)
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const slot = (WIDTH - PADDING.left - PADDING.right) / points.length
  const y = (value: number) => PADDING.top + ((max - value) / (max - min)) * plotHeight
  const x = (index: number) => PADDING.left + slot * index + slot / 2
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.savingsCents).toFixed(1)}`).join(' ')

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t('finance.charts.savings')}>
        <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(0)} y2={y(0)} className="chart-axis" />
        <path d={path} className="chart-line" />
        {points.map((point, index) => (
          <g key={point.month}>
            <circle cx={x(index)} cy={y(point.savingsCents)} r={3} className="chart-point" />
            <text x={x(index)} y={HEIGHT - 6} textAnchor="middle" className="chart-label">
              {monthLabel(point.month, locale)}
            </text>
          </g>
        ))}
      </svg>
      <table className="visually-hidden">
        <thead>
          <tr>
            <th>{t('finance.month')}</th>
            <th>{t('finance.savings')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.month}>
              <td>{point.month}</td>
              <td>{formatMoney(point.savingsCents, currency, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
