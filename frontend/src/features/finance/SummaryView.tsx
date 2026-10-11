import { useTranslation } from 'react-i18next'

import { formatMonthYear } from '../../lib/date'
import { formatMoney } from '../../lib/money'
import { useDateFormat } from '../../lib/useRelativeDate'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'
import { shiftMonth, useMonthSummary, useTrend, type Totals } from './api'
import { CategoryBars, IncomeExpenseChart, SavingsChart } from './charts'

const TREND_MONTHS = 6

interface SummaryViewProps {
  month: string
  currentMonth: string
  onMonthChange: (month: string) => void
  onSelectCategory: (categoryId: string) => void
}

export function SummaryView({ month, currentMonth, onMonthChange, onSelectCategory }: SummaryViewProps) {
  const { t } = useTranslation()
  const { locale } = useDateFormat()
  const summary = useMonthSummary(month)
  const trend = useTrend(month, TREND_MONTHS)

  const data = summary.data
  const currency = data?.currency ?? 'EUR'
  const money = (cents: number, signed = false) => formatMoney(cents, currency, locale, { signed })
  const expenses = data?.byCategory.filter((item) => item.kind === 'EXPENSE') ?? []
  const previousName = data ? formatMonthYear(`${data.previousMonth}-01`, locale, false) : ''
  const hasTrend = (trend.data?.points ?? []).some((p) => p.incomeCents || p.expenseCents)

  return (
    <div className="stack-lg">
      <div className="month-nav">
        <button
          type="button"
          className="icon-button"
          aria-label={t('finance.previousMonth')}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          <ChevronLeftIcon />
        </button>
        <h2 className="h2" aria-live="polite">
          {formatMonthYear(`${month}-01`, locale)}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t('finance.nextMonth')}
          disabled={month >= currentMonth}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          <ChevronRightIcon />
        </button>
      </div>

      {summary.isError && (
        <div className="alert alert-error" role="alert">
          {summary.error.message}
        </div>
      )}

      {data && (
        <>
          <div className="stat-grid">
            <Stat label={t('finance.income')} value={money(data.totals.incomeCents)} tone="income" />
            <Stat label={t('finance.expenses')} value={money(data.totals.expenseCents)} tone="expense" />
            <Stat
              label={t('finance.balance')}
              value={money(data.totals.balanceCents, true)}
              tone={data.totals.balanceCents < 0 ? 'expense' : 'income'}
            />
          </div>
          <Comparison current={data.totals} previous={data.previousTotals} previousName={previousName} money={money} />

          <section className="card stack" aria-labelledby="by-category-title">
            <h3 id="by-category-title" className="h3">
              {t('finance.byCategory')}
            </h3>
            {expenses.length === 0 ? (
              <p className="muted">{t('finance.noExpensesMonth')}</p>
            ) : (
              <CategoryBars items={expenses} currency={currency} locale={locale} onSelect={onSelectCategory} />
            )}
          </section>
        </>
      )}

      <section className="card stack" aria-labelledby="trend-title">
        <h3 id="trend-title" className="h3">
          {t('finance.trendTitle', { count: TREND_MONTHS })}
        </h3>
        {trend.data && hasTrend ? (
          <>
            <IncomeExpenseChart points={trend.data.points} currency={currency} locale={locale} />
            <div className="section-header">
              <h4 className="field-label">{t('finance.savingsTitle')}</h4>
              <strong className="stat-value">{money(trend.data.points[trend.data.points.length - 1].savingsCents)}</strong>
            </div>
            <p className="muted small">{t('finance.savingsHelp')}</p>
            <SavingsChart points={trend.data.points} currency={currency} locale={locale} />
          </>
        ) : (
          <p className="muted">{t('finance.noTrend')}</p>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value amount-${tone}`}>{value}</span>
    </div>
  )
}

/** Diferencia con el mes anterior, solo cuando hay datos con los que comparar. */
function Comparison({
  current,
  previous,
  previousName,
  money,
}: {
  current: Totals
  previous: Totals
  previousName: string
  money: (cents: number, signed?: boolean) => string
}) {
  const { t } = useTranslation()
  if (previous.incomeCents === 0 && previous.expenseCents === 0) return null
  const expenseDiff = current.expenseCents - previous.expenseCents
  const balanceDiff = current.balanceCents - previous.balanceCents
  return (
    <p className="comparison muted">
      {t(expenseDiff > 0 ? 'finance.compare.moreSpent' : expenseDiff < 0 ? 'finance.compare.lessSpent' : 'finance.compare.sameSpent', {
        amount: money(Math.abs(expenseDiff)),
        month: previousName,
      })}{' '}
      {t('finance.compare.balance', { amount: money(balanceDiff, true) })}
    </p>
  )
}
