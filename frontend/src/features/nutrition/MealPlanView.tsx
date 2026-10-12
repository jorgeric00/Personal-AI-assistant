import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { ApiError } from '../../api/client'
import { addDays, formatShortDate } from '../../lib/date'
import { formatDecimal } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../ui/icons'
import { useToast } from '../../ui/toast-context'
import {
  MEALS,
  useCopyWeek,
  useNutritionDay,
  usePlan,
  useSavedMeals,
  useSetPrepared,
  type PlannedMeal,
  type SavedMeal,
} from './api'
import { PlanEditor } from './PlanEditor'
import { NEW_PLAN, plannedCalories, shoppingList, weekStart } from './plan'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Plan semanal de comidas: qué comer cada día, qué preparar con antelación y la lista de la compra. Lo planificado no
 * cuenta como comido hasta que se pasa al diario. La semana y el formulario viven en la URL (?semana, ?plan).
 */
export function MealPlanView() {
  const { t } = useTranslation()
  const toast = useToast()
  const { today, locale } = useDateFormat()
  const [params, setParams] = useSearchParams()
  const weekParam = params.get('semana')
  const week = weekStart(weekParam && ISO_DATE.test(weekParam) ? weekParam : today)
  const end = addDays(week, 6)
  // También la semana anterior, para ofrecer repetirla
  const plan = usePlan(addDays(week, -7), end)
  const saved = useSavedMeals()
  const target = useNutritionDay(today).data?.target
  const copy = useCopyWeek()

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace: true },
    )

  const all = plan.data ?? []
  const thisWeek = all.filter((p) => p.date >= week)
  const previousWeek = all.filter((p) => p.date < week)
  const savedMeals = saved.data ?? []
  const planParam = params.get('plan')
  const editing = planParam && planParam !== NEW_PLAN ? thisWeek.find((p) => p.id === planParam) : undefined
  const newDate = params.get('planDia') ?? (today >= week && today <= end ? today : week)
  const newMeal = MEALS.find((m) => m === params.get('planComida')) ?? 'LUNCH'
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))

  return (
    <div className="stack-lg">
      <div className="agenda-nav">
        <button
          type="button"
          className="icon-button"
          aria-label={t('nutrition.plan.previousWeek')}
          onClick={() => update({ semana: addDays(week, -7) })}
        >
          <ChevronLeftIcon />
        </button>
        <h2 className="h2" aria-live="polite">
          {t('nutrition.plan.weekOf', { from: formatShortDate(week, locale), to: formatShortDate(end, locale) })}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t('nutrition.plan.nextWeek')}
          onClick={() => update({ semana: addDays(week, 7) })}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <p className="hint">{t('nutrition.plan.help')}</p>

      {plan.isPending ? (
        <div className="card skeleton" aria-hidden="true" />
      ) : plan.isError ? (
        <div className="alert alert-error" role="alert">
          {plan.error instanceof ApiError ? plan.error.message : t('errors.generic')}
        </div>
      ) : (
        <>
          {thisWeek.length === 0 && (
            <div className="card stack-sm">
              <p className="muted">{t('nutrition.plan.empty')}</p>
              {previousWeek.length > 0 && (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={copy.isPending}
                  onClick={() =>
                    copy.mutate(
                      { from: addDays(week, -7), to: week },
                      {
                        onSuccess: () => toast(t('nutrition.plan.copied')),
                        onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
                      },
                    )
                  }
                >
                  {t('nutrition.plan.copyPrevious', { count: previousWeek.length })}
                </button>
              )}
            </div>
          )}

          <ul className="list-plain stack" aria-label={t('nutrition.plan.daysLabel')}>
            {days.map((day) => (
              <PlanDay
                key={day}
                date={day}
                plans={thisWeek.filter((p) => p.date === day)}
                savedMeals={savedMeals}
                targetCalories={target?.calories ?? null}
                onAdd={() => update({ plan: NEW_PLAN, planDia: day, planComida: null })}
                onOpen={(id) => update({ plan: id })}
              />
            ))}
          </ul>

          <PrepList plans={thisWeek} />
          <ShoppingList plans={thisWeek.filter((p) => p.date >= today)} savedMeals={savedMeals} />
        </>
      )}

      {planParam && saved.data && (planParam === NEW_PLAN || editing) && (
        <PlanEditor
          key={planParam}
          plan={editing ?? null}
          date={newDate}
          meal={newMeal}
          savedMeals={savedMeals}
          onClose={() => update({ plan: null, planDia: null, planComida: null })}
        />
      )}
    </div>
  )
}

interface PlanDayProps {
  date: string
  plans: PlannedMeal[]
  savedMeals: SavedMeal[]
  targetCalories: number | null
  onAdd: () => void
  onOpen: (id: string) => void
}

function PlanDay({ date, plans, savedMeals, targetCalories, onAdd, onOpen }: PlanDayProps) {
  const { t } = useTranslation()
  const { relativeDate, locale, today } = useDateFormat()
  const calories = plannedCalories(plans, savedMeals)
  const label = date === today ? `${relativeDate(date)} · ${formatShortDate(date, locale)}` : relativeDate(date)
  const titleId = `plan-day-${date}`

  return (
    <li className="card stack-sm" aria-labelledby={titleId}>
      <div className="section-header">
        <h3 id={titleId} className="h3">
          {label}
        </h3>
        <button
          type="button"
          className="button button-ghost button-small"
          aria-label={t('nutrition.plan.addTo', { day: relativeDate(date) })}
          onClick={onAdd}
        >
          <PlusIcon />
          {t('nutrition.addFood')}
        </button>
      </div>
      {plans.length === 0 ? (
        <p className="muted small">{t('nutrition.plan.nothing')}</p>
      ) : (
        <ul className="list-plain plan-items">
          {plans.map((p) => (
            <li key={p.id}>
              <button type="button" className="plan-item" onClick={() => onOpen(p.id)}>
                <span className="plan-item-meal">{t(`nutrition.meals.${p.meal}`)}</span>
                <span className="food-name">{p.title}</span>
                <span className="food-meta">
                  {[
                    p.logged && t('nutrition.plan.loggedBadge'),
                    p.prepDate &&
                      (p.prepared
                        ? t('nutrition.plan.preparedBadge')
                        : t('nutrition.plan.prepOn', { day: relativeDate(p.prepDate) })),
                    p.notes,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {calories.known > 0 && (
        <p className="muted small">
          {t('nutrition.plan.dayCalories', {
            value: `${calories.estimated ? '≈ ' : ''}${formatDecimal(calories.calories, locale, 0)}`,
          })}
          {targetCalories != null && ` · ${t('nutrition.plan.target', { value: formatDecimal(targetCalories, locale, 0) })}`}
          {calories.known < plans.length && ` · ${t('nutrition.plan.partial')}`}
        </p>
      )}
    </li>
  )
}

/** Lo que hay que preparar con antelación, por día de preparación. */
function PrepList({ plans }: { plans: PlannedMeal[] }) {
  const { t } = useTranslation()
  // Lo marcado se ve al momento, sin esperar a que el servidor responda
  const [marking, setMarking] = useState<Record<string, boolean>>({})
  const prep = plans.filter((p) => p.prepDate).sort((a, b) => a.prepDate!.localeCompare(b.prepDate!))
  if (prep.length === 0) return null
  const pending = prep.filter((p) => !(marking[p.id] ?? p.prepared)).length
  const mark = (id: string, prepared: boolean | null) =>
    setMarking((current) => {
      const next = { ...current }
      if (prepared == null) delete next[id]
      else next[id] = prepared
      return next
    })

  return (
    <section className="stack-sm" aria-labelledby="prep-title">
      <h2 id="prep-title" className="h2">
        {t('nutrition.plan.prepTitle')}
      </h2>
      <div className="card stack-sm">
        <p className="muted small">
          {pending === 0 ? t('nutrition.plan.prepDone') : t('nutrition.plan.prepPending', { count: pending })}
        </p>
        <ul className="list-plain stack-sm">
          {prep.map((p) => (
            <PrepRow key={p.id} plan={p} checked={marking[p.id] ?? p.prepared} onMark={(value) => mark(p.id, value)} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function PrepRow({ plan, checked, onMark }: { plan: PlannedMeal; checked: boolean; onMark: (v: boolean | null) => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { relativeDate } = useDateFormat()
  const setPrepared = useSetPrepared()
  const toggle = (prepared: boolean) => {
    onMark(prepared)
    setPrepared.mutate(
      { id: plan.id, prepared },
      {
        onError: (err) => toast(err instanceof ApiError ? err.message : t('errors.generic'), { tone: 'error' }),
        onSettled: () => onMark(null),
      },
    )
  }

  return (
    <li>
      <label className="checkbox-row">
        <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} />
        <span>
          {plan.title}
          <span className="muted small">
            {' · '}
            {t('nutrition.plan.prepFor', {
              prep: relativeDate(plan.prepDate!),
              day: relativeDate(plan.date),
              meal: t(`nutrition.meals.${plan.meal}`).toLocaleLowerCase(),
            })}
          </span>
        </span>
      </label>
    </li>
  )
}

/** Alimentos de las comidas habituales planificadas desde hoy, juntados para la compra. */
function ShoppingList({ plans, savedMeals }: { plans: PlannedMeal[]; savedMeals: SavedMeal[] }) {
  const { t } = useTranslation()
  const { locale } = useDateFormat()
  const { items, withoutItems } = shoppingList(plans, savedMeals)
  if (items.length === 0 && withoutItems.length === 0) return null

  return (
    <section className="stack-sm" aria-labelledby="shopping-title">
      <h2 id="shopping-title" className="h2">
        {t('nutrition.plan.shoppingTitle')}
      </h2>
      <div className="card stack-sm">
        {items.length > 0 ? (
          <ul className="list-plain shopping-list">
            {items.map((item) => (
              <li key={`${item.name}|${item.unit ?? ''}`}>
                <span>{item.name}</span>
                <span className="muted">
                  {item.quantity != null
                    ? `${formatDecimal(item.quantity, locale, 2)}${item.unit ? ` ${item.unit}` : ''}`
                    : item.times > 1
                      ? `× ${item.times}`
                      : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{t('nutrition.plan.shoppingEmpty')}</p>
        )}
        {items.length > 0 && <p className="hint">{t('nutrition.plan.shoppingHelp')}</p>}
        {withoutItems.length > 0 && (
          <p className="hint">
            {t('nutrition.plan.shoppingWithout', { meals: [...new Set(withoutItems.map((p) => p.title))].join(', ') })}
          </p>
        )}
      </div>
    </section>
  )
}
