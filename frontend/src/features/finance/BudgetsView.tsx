import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { formatShortDate } from '../../lib/date'
import { centsToInput, formatMoney, parseAmount } from '../../lib/money'
import { useDateFormat } from '../../lib/useRelativeDate'
import { useToast } from '../../ui/toast-context'
import {
  useBudgets,
  useDeleteBudget,
  useDeleteRecurring,
  useFinanceCategories,
  useRecurring,
  useSetBudget,
  useStopRecurring,
  type BudgetStatus,
  type Recurring,
} from './api'

/** Barra de un presupuesto: gastado frente al límite, coloreada según el nivel de aviso. */
export function BudgetBar({ budget, locale }: { budget: BudgetStatus; locale: string }) {
  const { t } = useTranslation()
  const ratio = budget.amountCents ? budget.spentCents / budget.amountCents : 0
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(ratio)
  const money = (cents: number) => formatMoney(cents, budget.currency, locale)
  const left = budget.amountCents - budget.spentCents
  return (
    <span className="stack-sm">
      <span className="category-bar-head">
        <span className="category-tag">
          <span className="category-dot" style={{ background: budget.category.color }} aria-hidden="true" />
          {budget.category.name}
        </span>
        <span className="category-bar-amount">
          {t('finance.budgets.spentOf', { spent: money(budget.spentCents), limit: money(budget.amountCents) })}
        </span>
      </span>
      <span
        className="category-bar-track"
        role="progressbar"
        aria-label={budget.category.name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
        aria-valuetext={percent}
      >
        <span className={`category-bar-fill budget-fill-${budget.level}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </span>
      <span className={`budget-meta budget-level-${budget.level}`}>
        {percent} ·{' '}
        {left >= 0 ? t('finance.budgets.left', { amount: money(left) }) : t('finance.budgets.over', { amount: money(-left) })}
      </span>
    </span>
  )
}

/** Presupuestos mensuales por categoría y movimientos recurrentes. */
export function BudgetsView({ month, onAddRecurring }: { month: string; onAddRecurring: () => void }) {
  return (
    <div className="stack-lg">
      <BudgetsSection month={month} />
      <RecurringSection onAdd={onAddRecurring} />
    </div>
  )
}

function BudgetsSection({ month }: { month: string }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale } = useDateFormat()
  const budgets = useBudgets(month)
  const categories = useFinanceCategories()
  const setBudget = useSetBudget()
  const remove = useDeleteBudget()
  // categoryId === '' significa «nuevo presupuesto» con la categoría aún sin elegir.
  const [draft, setDraft] = useState<{ categoryId: string; amount: string; editing: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const used = new Set((budgets.data ?? []).map((b) => b.category.id))
  const available = (categories.data ?? []).filter((c) => c.kind === 'EXPENSE' && !c.archived && !used.has(c.id))

  const close = () => {
    setDraft(null)
    setError(null)
  }

  const submit = () => {
    if (!draft) return
    const cents = parseAmount(draft.amount)
    if (cents === null) {
      setError(t('finance.form.amountInvalid'))
      return
    }
    if (!draft.categoryId) {
      setError(t('finance.budgets.chooseCategory'))
      return
    }
    setBudget.mutate(
      { categoryId: draft.categoryId, amountCents: cents },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          close()
        },
        onError: (e) => setError(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : t('errors.generic')),
      },
    )
  }

  const form = (budget?: BudgetStatus) =>
    draft && (
      <form
        className="stack-sm settings-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {budget ? (
          <span className="category-tag">
            <span className="category-dot" style={{ background: budget.category.color }} aria-hidden="true" />
            {budget.category.name}
          </span>
        ) : (
          <div className="field">
            <label htmlFor="budget-category">{t('finance.form.category')}</label>
            <select
              id="budget-category"
              value={draft.categoryId}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
            >
              <option value="">{t('finance.budgets.chooseCategory')}</option>
              {available.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="budget-amount">{t('finance.budgets.limit')}</label>
          <input
            id="budget-amount"
            className="amount-input"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={Boolean(budget)}
            value={draft.amount}
            placeholder={centsToInput(0, locale)}
            aria-invalid={Boolean(error)}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="inline-form">
          {budget && (
            <button
              type="button"
              className="button button-danger-outline button-small"
              onClick={() => remove.mutate(budget.id, { onSuccess: close })}
            >
              {t('common.delete')}
            </button>
          )}
          <button type="button" className="button button-ghost button-small" onClick={close}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button-primary button-small" disabled={setBudget.isPending}>
            {t('common.save')}
          </button>
        </div>
      </form>
    )

  const list = budgets.data ?? []
  return (
    <section className="stack-sm" aria-labelledby="budgets-title">
      <div className="section-header">
        <h2 id="budgets-title" className="h2">
          {t('finance.budgets.title')}
        </h2>
        {available.length > 0 && (
          <button
            type="button"
            className="link link-button"
            onClick={() => {
              setError(null)
              setDraft({ categoryId: '', amount: '', editing: false })
            }}
          >
            {t('finance.budgets.add')}
          </button>
        )}
      </div>
      <p className="muted small">{t('finance.budgets.help')}</p>
      {budgets.isError && (
        <div className="alert alert-error" role="alert">
          {budgets.error.message}
        </div>
      )}
      {list.length === 0 && !(draft && !draft.editing) && budgets.isSuccess ? (
        <div className="card empty-state">
          <p className="muted">{t('finance.budgets.empty')}</p>
        </div>
      ) : (
        <ul className="card list-plain budget-list">
          {draft && !draft.editing && <li className="budget-row">{form()}</li>}
          {list.map((budget) => (
            <li key={budget.id} className="budget-row">
              {draft?.editing && draft.categoryId === budget.category.id ? (
                form(budget)
              ) : (
                <button
                  type="button"
                  className="budget-row-button"
                  aria-label={t('finance.budgets.edit', { category: budget.category.name })}
                  onClick={() => {
                    setError(null)
                    setDraft({ categoryId: budget.category.id, amount: centsToInput(budget.amountCents, locale), editing: true })
                  }}
                >
                  <BudgetBar budget={budget} locale={locale} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecurringSection({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()
  const recurring = useRecurring()
  const list = recurring.data ?? []
  return (
    <section className="stack-sm" aria-labelledby="recurring-title">
      <div className="section-header">
        <h2 id="recurring-title" className="h2">
          {t('finance.recurring.title')}
        </h2>
        <button type="button" className="link link-button" onClick={onAdd}>
          {t('finance.recurring.add')}
        </button>
      </div>
      <p className="muted small">{t('finance.recurring.help')}</p>
      {recurring.isError && (
        <div className="alert alert-error" role="alert">
          {recurring.error.message}
        </div>
      )}
      {list.length === 0 && recurring.isSuccess ? (
        <div className="card empty-state">
          <p className="muted">{t('finance.recurring.empty')}</p>
        </div>
      ) : (
        <ul className="card list-plain">
          {list.map((rule) => (
            <RecurringRow key={rule.id} rule={rule} />
          ))}
        </ul>
      )}
    </section>
  )
}

function RecurringRow({ rule }: { rule: Recurring }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale } = useDateFormat()
  const stop = useStopRecurring()
  const remove = useDeleteRecurring()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sign = rule.kind === 'INCOME' ? 1 : -1
  const active = rule.nextDate !== null

  return (
    <li className="recurring-row">
      <span className="category-dot category-dot-large" style={{ background: rule.category.color }} aria-hidden="true" />
      <span className="movement-main">
        <span className="movement-title">{rule.description || rule.category.name}</span>
        <span className="movement-meta">
          {t(`finance.recurring.every.${rule.frequency}`, { count: rule.every })} ·{' '}
          {active
            ? t('finance.recurring.next', { date: formatShortDate(rule.nextDate!, locale) })
            : t('finance.recurring.ended')}
        </span>
        <span className={`movement-amount amount-${rule.kind === 'INCOME' ? 'income' : 'expense'}`}>
          {formatMoney(sign * rule.amountCents, rule.currency, locale, { signed: true })}
        </span>
        {confirmDelete && (
          <span className="small" role="alert">
            {t('finance.recurring.deleteConfirm')}
          </span>
        )}
      </span>
      <span className="recurring-actions">
        {confirmDelete ? (
          <>
            <button type="button" className="button button-ghost button-small" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="button button-danger button-small"
              onClick={() => remove.mutate(rule.id, { onSuccess: () => toast(t('common.deleted')) })}
            >
              {t('common.confirmDelete')}
            </button>
          </>
        ) : (
          <>
            {active && (
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={stop.isPending}
                onClick={() => stop.mutate(rule.id, { onSuccess: () => toast(t('finance.recurring.stopped')) })}
              >
                {t('finance.recurring.stop')}
              </button>
            )}
            <button
              type="button"
              className="button button-ghost button-small"
              aria-label={t('finance.recurring.delete')}
              onClick={() => setConfirmDelete(true)}
            >
              {t('common.delete')}
            </button>
          </>
        )}
      </span>
    </li>
  )
}
