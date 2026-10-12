import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatMoney } from '../../lib/money'
import { useDateFormat } from '../../lib/useRelativeDate'
import { SearchIcon } from '../../ui/icons'
import { useFinanceCategories, useMovements, type Movement, type MovementFilters, type MovementKind } from './api'
import { CsvActions } from './CsvActions'
import { MovementItem } from './MovementItem'

interface MovementsViewProps {
  filters: MovementFilters
  onFiltersChange: (changes: Partial<Record<keyof MovementFilters, string | null>>) => void
  onOpen: (id: string) => void
}

export function MovementsView({ filters, onFiltersChange, onOpen }: MovementsViewProps) {
  const { t } = useTranslation()
  const { locale, relativeDate } = useDateFormat()
  const [search, setSearch] = useState(filters.q ?? '')
  const categories = useFinanceCategories()
  const movements = useMovements(filters)

  useEffect(() => {
    const id = window.setTimeout(() => {
      if ((filters.q ?? '') !== search.trim()) onFiltersChange({ q: search.trim() || null })
    }, 300)
    return () => window.clearTimeout(id)
  }, [search, filters.q, onFiltersChange])

  const pages = movements.data?.pages ?? []
  const first = pages[0]
  const items = pages.flatMap((page) => page.items)
  const currency = first?.currency ?? 'EUR'
  const groups = groupByDate(items)
  const filtered = Boolean(filters.from || filters.to || filters.kind || filters.categoryId || filters.q)
  const visibleCategories = (categories.data ?? []).filter((c) => !filters.kind || c.kind === filters.kind)

  return (
    <div className="stack-lg">
      <label className="search-field">
        <SearchIcon />
        <span className="visually-hidden">{t('finance.filters.search')}</span>
        <input type="search" value={search} placeholder={t('finance.filters.search')} onChange={(e) => setSearch(e.target.value)} />
      </label>

      <div className="filters filters-wrap">
        <label className="filter">
          <span className="visually-hidden">{t('finance.filters.kind')}</span>
          <select
            value={filters.kind ?? ''}
            onChange={(e) => onFiltersChange({ kind: e.target.value || null, categoryId: null })}
          >
            <option value="">
              {t('finance.filters.kind')}: {t('finance.filters.any')}
            </option>
            {(['EXPENSE', 'INCOME'] as MovementKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {t(`finance.kind.${kind}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span className="visually-hidden">{t('finance.filters.category')}</span>
          <select value={filters.categoryId ?? ''} onChange={(e) => onFiltersChange({ categoryId: e.target.value || null })}>
            <option value="">
              {t('finance.filters.category')}: {t('finance.filters.any')}
            </option>
            {visibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter filter-date">
          <span>{t('finance.filters.from')}</span>
          <input type="date" value={filters.from ?? ''} max={filters.to} onChange={(e) => onFiltersChange({ from: e.target.value || null })} />
        </label>
        <label className="filter filter-date">
          <span>{t('finance.filters.to')}</span>
          <input type="date" value={filters.to ?? ''} min={filters.from} onChange={(e) => onFiltersChange({ to: e.target.value || null })} />
        </label>
      </div>
      {filtered && (
        <button
          type="button"
          className="link link-button"
          onClick={() => {
            setSearch('')
            onFiltersChange({ from: null, to: null, kind: null, categoryId: null, q: null })
          }}
        >
          {t('finance.filters.clear')}
        </button>
      )}

      {first && (
        <div className="totals-bar card" aria-label={t('finance.filters.totals')}>
          <span>
            <span className="stat-label">{t('finance.income')}</span>
            <span className="amount-income">{formatMoney(first.totals.incomeCents, currency, locale)}</span>
          </span>
          <span>
            <span className="stat-label">{t('finance.expenses')}</span>
            <span className="amount-expense">{formatMoney(first.totals.expenseCents, currency, locale)}</span>
          </span>
          <span>
            <span className="stat-label">{t('finance.balance')}</span>
            <span className={first.totals.balanceCents < 0 ? 'amount-expense' : 'amount-income'}>
              {formatMoney(first.totals.balanceCents, currency, locale, { signed: true })}
            </span>
          </span>
        </div>
      )}

      {movements.isPending && (
        <div className="screen-center-inline" role="status">
          <span className="spinner" aria-hidden="true" />
          <span className="visually-hidden">{t('common.loading')}</span>
        </div>
      )}
      {movements.isError && (
        <div className="alert alert-error" role="alert">
          {movements.error.message}
        </div>
      )}
      {movements.isSuccess && items.length === 0 && (
        <div className="card empty-state">
          <p className="muted">{t(filtered ? 'finance.empty.filtered' : 'finance.empty.movements')}</p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.date} className="stack-sm" aria-label={relativeDate(group.date)}>
          <h2 className="group-title">{relativeDate(group.date)}</h2>
          <ul className="card list-plain movement-list">
            {group.items.map((movement) => (
              <MovementItem key={movement.id} movement={movement} locale={locale} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}

      {movements.hasNextPage && (
        <button
          type="button"
          className="button button-secondary"
          disabled={movements.isFetchingNextPage}
          onClick={() => void movements.fetchNextPage()}
        >
          {movements.isFetchingNextPage ? t('common.loading') : t('finance.loadMore')}
        </button>
      )}

      <CsvActions filters={filters} />
    </div>
  )
}

function groupByDate(items: Movement[]) {
  const groups: { date: string; items: Movement[] }[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.date === item.date) last.items.push(item)
    else groups.push({ date: item.date, items: [item] })
  }
  return groups
}
