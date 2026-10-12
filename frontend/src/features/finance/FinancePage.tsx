import type { ParseKeys } from 'i18next'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon } from '../../ui/icons'
import { monthRange, useMovement, type MovementFilters, type MovementKind } from './api'
import { BudgetsView } from './BudgetsView'
import { CategoriesView } from './CategoriesView'
import { MovementEditor } from './MovementEditor'
import { MovementsView } from './MovementsView'
import { SummaryView } from './SummaryView'

type Tab = 'SUMMARY' | 'MOVEMENTS' | 'BUDGETS' | 'CATEGORIES'

const TABS: { value: Tab; label: ParseKeys }[] = [
  { value: 'SUMMARY', label: 'finance.views.summary' },
  { value: 'MOVEMENTS', label: 'finance.views.movements' },
  { value: 'BUDGETS', label: 'finance.views.budgets' },
  { value: 'CATEGORIES', label: 'finance.views.categories' },
]

/** Parámetros de la URL para cada filtro del historial. */
const FILTER_PARAMS: Record<keyof MovementFilters, string> = {
  from: 'desde',
  to: 'hasta',
  kind: 'tipo',
  categoryId: 'categoria',
  q: 'q',
}

/**
 * Pantalla de finanzas. El estado vive en la URL (?vista, ?mes, filtros, ?movimiento, ?nuevo, ?repetir) para que los
 * accesos rápidos abran directamente el formulario y se pueda volver atrás sin perder los filtros.
 */
export function FinancePage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { today } = useDateFormat()
  const currentMonth = today.slice(0, 7)

  const tab = TABS.find((item) => item.value === params.get('vista'))?.value ?? 'SUMMARY'
  const month = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : currentMonth
  const editingId = params.get('movimiento')
  const newKind = params.get('nuevo') as MovementKind | null
  const editing = useMovement(editingId)

  const filters: MovementFilters = {
    from: params.get('desde') ?? undefined,
    to: params.get('hasta') ?? undefined,
    kind: (['INCOME', 'EXPENSE'].includes(params.get('tipo') ?? '') ? params.get('tipo') : undefined) as
      | MovementKind
      | undefined,
    categoryId: params.get('categoria') ?? undefined,
    q: params.get('q') ?? undefined,
  }

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const updateFilters = useCallback(
    (changes: Partial<Record<keyof MovementFilters, string | null>>) =>
      update(
        Object.fromEntries(
          Object.entries(changes).map(([key, value]) => [FILTER_PARAMS[key as keyof MovementFilters], value ?? null]),
        ),
      ),
    [update],
  )

  return (
    <div className="page stack-lg">
      <header className="page-header page-header-row">
        <h1 className="h1">{t('finance.title')}</h1>
        <button type="button" className="button button-primary button-small" onClick={() => update({ nuevo: 'EXPENSE' })}>
          <PlusIcon />
          {t('finance.add')}
        </button>
      </header>

      <nav className="tabs" aria-label={t('finance.viewsLabel')}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            className="tab"
            aria-current={tab === item.value ? 'page' : undefined}
            onClick={() => update({ vista: item.value === 'SUMMARY' ? null : item.value })}
          >
            {t(item.label)}
          </button>
        ))}
      </nav>

      {tab === 'SUMMARY' && (
        <SummaryView
          month={month}
          currentMonth={currentMonth}
          onMonthChange={(next) => update({ mes: next === currentMonth ? null : next })}
          onOpenBudgets={() => update({ vista: 'BUDGETS' })}
          onSelectCategory={(categoryId) => {
            const { from, to } = monthRange(month)
            update({ vista: 'MOVEMENTS', categoria: categoryId, tipo: 'EXPENSE', desde: from, hasta: to, q: null })
          }}
        />
      )}
      {tab === 'MOVEMENTS' && (
        <MovementsView filters={filters} onFiltersChange={updateFilters} onOpen={(id) => update({ movimiento: id })} />
      )}
      {tab === 'BUDGETS' && <BudgetsView month={currentMonth} onAddRecurring={() => update({ nuevo: 'EXPENSE', repetir: '1' })} />}
      {tab === 'CATEGORIES' && <CategoriesView />}

      {(newKind || (editingId && editing.data)) && (
        <MovementEditor
          key={editingId ?? `${newKind}-${params.get('repetir') ?? ''}`}
          movement={editingId ? (editing.data ?? null) : null}
          initialKind={newKind === 'INCOME' ? 'INCOME' : 'EXPENSE'}
          initialRepeat={params.get('repetir') === '1'}
          onClose={() => update({ movimiento: null, nuevo: null, repetir: null })}
        />
      )}
    </div>
  )
}
