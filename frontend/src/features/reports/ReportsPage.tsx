import { useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { ApiError } from '../../api/client'
import { addDays, formatDateWithYear, formatMonthYear } from '../../lib/date'
import { formatDecimal } from '../../lib/decimal'
import { formatMoney } from '../../lib/money'
import { useDateFormat } from '../../lib/useRelativeDate'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'
import { METRIC_UNITS } from '../fitness/api'
import { useReport, type BodyChange, type HabitSummary, type Report, type ReportPeriod } from './api'

const PERIOD_PARAMS: Record<string, ReportPeriod> = { semana: 'WEEK', mes: 'MONTH' }
const PARAM_OF: Record<ReportPeriod, string> = { WEEK: 'semana', MONTH: 'mes' }

/** «19–25 oct 2026» o «28 sept – 4 oct 2026». */
function formatRange(from: string, to: string, locale: string) {
  if (from === to) return formatDateWithYear(from, locale)
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return format.formatRange(new Date(`${from}T12:00:00Z`), new Date(`${to}T12:00:00Z`))
}

/**
 * Informes por semana o por mes con lo registrado en cada módulo, junto a la cifra del periodo anterior. Se muestran
 * los datos tal cual, sin valorarlos. El periodo vive en ?periodo y ?fecha.
 */
export function ReportsPage() {
  const { t } = useTranslation()
  const { today, locale } = useDateFormat()
  const [params, setParams] = useSearchParams()
  const period = PERIOD_PARAMS[params.get('periodo') ?? ''] ?? 'WEEK'
  const requested = params.get('fecha')
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today
  const report = useReport(period, date)
  const data = report.data

  const go = useCallback(
    (next: { period?: ReportPeriod; date?: string }) =>
      setParams(
        (current) => {
          const result = new URLSearchParams(current)
          result.set('periodo', PARAM_OF[next.period ?? period])
          const nextDate = next.date ?? date
          if (nextDate === today) result.delete('fecha')
          else result.set('fecha', nextDate)
          return result
        },
        { replace: true },
      ),
    [setParams, period, date, today],
  )

  const title = data
    ? period === 'MONTH'
      ? formatMonthYear(data.start, locale)
      : formatRange(data.start, data.end, locale)
    : ''

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <h1 className="h1">{t('reports.title')}</h1>
      </header>

      <div className="segmented segmented-2" role="radiogroup" aria-label={t('reports.periodLabel')}>
        {(['WEEK', 'MONTH'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            className="segmented-option"
            onClick={() => go({ period: p })}
          >
            {t(`reports.period.${p}`)}
          </button>
        ))}
      </div>

      <div className="month-nav">
        <button
          type="button"
          className="icon-button"
          aria-label={t(`reports.previous.${period}`)}
          disabled={!data}
          onClick={() => data && go({ date: addDays(data.start, -1) })}
        >
          <ChevronLeftIcon />
        </button>
        <h2 className="h2" aria-live="polite">
          {title}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t(`reports.next.${period}`)}
          disabled={!data || data.end >= today}
          onClick={() => data && go({ date: addDays(data.end, 1) })}
        >
          <ChevronRightIcon />
        </button>
      </div>

      {report.isPending ? (
        <div className="card skeleton" aria-hidden="true" />
      ) : report.isError ? (
        <div className="alert alert-error" role="alert">
          {report.error instanceof ApiError ? report.error.message : t('errors.generic')}
        </div>
      ) : (
        <ReportContent report={report.data} locale={locale} />
      )}
    </div>
  )
}

function ReportContent({ report, locale }: { report: Report; locale: string }) {
  const { t } = useTranslation()
  const previous = formatRange(report.previousFrom, report.previousTo, locale)
  const number = (value: number) => new Intl.NumberFormat(locale).format(value)
  const { finance, nutrition } = report
  const currency = finance.currency ?? 'EUR'
  const money = (cents: number, signed = false) => formatMoney(cents, currency, locale, { signed })
  const hasMoney = finance.incomeCents > 0 || finance.expenseCents > 0
  const hadMoney = finance.previousIncomeCents > 0 || finance.previousExpenseCents > 0
  const maxExpense = Math.max(...finance.topExpenses.map((e) => e.amountCents), 1)

  return (
    <>
      <p className="muted small">
        {report.partial
          ? t('reports.partial', { to: formatDateWithYear(report.to, locale), previous })
          : t('reports.comparedWith', { previous })}
      </p>

      <section className="stack-sm" aria-labelledby="report-activity-title">
        <h2 id="report-activity-title" className="h2">
          {t('reports.activity')}
        </h2>
        <div className="stat-grid stat-grid-2">
          <ReportStat label={t('reports.tasksDone')} value={report.tasks.completed} previous={report.tasks.previousCompleted} />
          <ReportStat label={t('reports.workouts')} value={report.training.workouts} previous={report.training.previousWorkouts} />
          <ReportStat label={t('reports.sets')} value={report.training.setsDone} previous={report.training.previousSetsDone} />
          <ReportStat label={t('reports.foodDays')} value={nutrition.loggedDays} previous={nutrition.previousLoggedDays} />
        </div>
      </section>

      <ReportSection id="report-finance-title" title={t('reports.finance')}>
        {!hasMoney && !hadMoney ? (
          <p className="muted">{t('reports.noMovements')}</p>
        ) : (
          <>
            <dl className="report-rows">
              <Row label={t('finance.income')} value={money(finance.incomeCents)} previous={money(finance.previousIncomeCents)} />
              <Row label={t('finance.expenses')} value={money(finance.expenseCents)} previous={money(finance.previousExpenseCents)} />
              <Row
                label={t('finance.balance')}
                value={money(finance.incomeCents - finance.expenseCents, true)}
                previous={money(finance.previousIncomeCents - finance.previousExpenseCents, true)}
              />
            </dl>
            {finance.topExpenses.length > 0 && (
              <>
                <h3 className="h3">{t('reports.topExpenses')}</h3>
                <ul className="category-bars list-plain">
                  {finance.topExpenses.map((item) => (
                    <li key={item.id} className="category-bar">
                      <span className="category-bar-head">
                        <span className="category-tag">
                          <span className="category-dot" style={{ background: item.color }} aria-hidden="true" />
                          {item.name}
                        </span>
                        <span className="category-bar-amount">{money(item.amountCents)}</span>
                      </span>
                      <span className="category-bar-track" aria-hidden="true">
                        <span
                          className="category-bar-fill"
                          style={{ width: `${(item.amountCents / maxExpense) * 100}%`, background: item.color }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </ReportSection>

      <ReportSection id="report-nutrition-title" title={t('reports.nutrition')}>
        {nutrition.averageCalories === null && nutrition.previousAverageCalories === null ? (
          <p className="muted">{t(nutrition.loggedDays > 0 ? 'reports.noCalories' : 'reports.noFood')}</p>
        ) : (
          <>
            <dl className="report-rows">
              <Row
                label={t('reports.averageCalories')}
                value={nutrition.averageCalories === null ? '—' : t('reports.kcal', { value: number(nutrition.averageCalories) })}
                previous={
                  nutrition.previousAverageCalories === null
                    ? '—'
                    : t('reports.kcal', { value: number(nutrition.previousAverageCalories) })
                }
              />
            </dl>
            <p className="muted small">{t('reports.caloriesHelp')}</p>
            {nutrition.estimated && <p className="muted small">{t('reports.estimated')}</p>}
          </>
        )}
      </ReportSection>

      <ReportSection id="report-habits-title" title={t('reports.habits')}>
        {report.habits.length === 0 ? (
          <p className="muted">
            {t('reports.noHabits')}{' '}
            <Link to="/habitos" className="link">
              {t('reports.goHabits')}
            </Link>
          </p>
        ) : (
          <ul className="list-plain stack-sm">
            {report.habits.map((habit) => (
              <HabitRow key={habit.id} habit={habit} />
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection id="report-body-title" title={t('reports.body')}>
        {report.body.length === 0 ? (
          <p className="muted">{t('reports.noBody')}</p>
        ) : (
          <ul className="list-plain stack-sm">
            {report.body.map((change) => (
              <BodyRow key={change.metric} change={change} locale={locale} />
            ))}
          </ul>
        )}
      </ReportSection>

      <p className="muted small">{t('reports.disclaimer')}</p>
    </>
  )
}

function ReportSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="card stack-sm" aria-labelledby={id}>
      <h2 id={id} className="h2">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ReportStat({ label, value, previous }: { label: string; value: number; previous: number }) {
  const { t } = useTranslation()
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="muted small">{t('reports.previousValue', { value: previous })}</span>
    </div>
  )
}

function Row({ label, value, previous }: { label: string; value: string; previous: string }) {
  const { t } = useTranslation()
  return (
    <div className="report-row">
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        <span className="muted small">{t('reports.previousValue', { value: previous })}</span>
      </dd>
    </div>
  )
}

const rate = (done: number, expected: number | null) =>
  expected ? Math.round((Math.min(done, expected) / expected) * 100) : null

function HabitRow({ habit }: { habit: HabitSummary }) {
  const { t } = useTranslation()
  const daily = habit.frequency === 'DAILY'
  const current = rate(habit.done, habit.expected)
  const before = rate(habit.previousDone, habit.previousExpected)
  return (
    <li className="report-habit">
      <span className="category-tag">
        <span className="category-dot" style={{ background: habit.color }} aria-hidden="true" />
        {habit.name}
      </span>
      <span className="report-habit-value">
        {daily
          ? habit.expected
            ? t('reports.habitDaily', { done: Math.min(habit.done, habit.expected), expected: habit.expected, rate: current })
            : t('reports.habitNothingExpected')
          : t('reports.habitWeekly', { count: habit.done, target: habit.timesPerWeek })}
        <span className="muted small">
          {t('reports.previousValue', {
            value: daily
              ? habit.previousExpected
                ? `${before}\u00a0%`
                : '—'
              : t('reports.times', { count: habit.previousDone }),
          })}
        </span>
      </span>
    </li>
  )
}

function BodyRow({ change, locale }: { change: BodyChange; locale: string }) {
  const { t } = useTranslation()
  const unit = METRIC_UNITS[change.metric]
  const value = (n: number) => `${formatDecimal(n, locale, 2)} ${unit}`
  const label = t(`fitness.metrics.${change.metric}`)
  return (
    <li className="report-row">
      <span>{label}</span>
      <span>
        {change.count === 1 ? (
          <>
            <strong>{value(change.last)}</strong>
            <span className="muted small">{formatDateWithYear(change.lastDate, locale)}</span>
          </>
        ) : (
          <>
            <strong>
              {value(change.first)} → {value(change.last)}
            </strong>
            <span className="muted small">
              {t('reports.bodyChange', {
                diff: `${formatDecimal(change.last - change.first, locale, 2, true)} ${unit}`,
                from: formatDateWithYear(change.firstDate, locale),
                to: formatDateWithYear(change.lastDate, locale),
              })}
            </span>
          </>
        )}
      </span>
    </li>
  )
}
