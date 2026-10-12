import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useToast } from '../../ui/toast-context'
import { useLogPlan, usePlan } from './api'

/** En el diario, lo planificado para ese día que aún no se ha registrado, para pasarlo con un toque. */
export function PlannedForDay({ date }: { date: string }) {
  const { t } = useTranslation()
  const toast = useToast()
  const plan = usePlan(date, date)
  const log = useLogPlan()
  const pending = (plan.data ?? []).filter((p) => p.date === date && !p.logged)
  if (pending.length === 0) return null

  return (
    <section className="card stack-sm" aria-labelledby="planned-day-title">
      <h2 id="planned-day-title" className="h3">
        {t('nutrition.plan.plannedToday')}
      </h2>
      <ul className="list-plain stack-sm">
        {pending.map((p) => (
          <li key={p.id} className="planned-row">
            <span>
              <span className="plan-item-meal">{t(`nutrition.meals.${p.meal}`)}</span>
              <span className="food-name">{p.title}</span>
            </span>
            <button
              type="button"
              className="button button-secondary button-small"
              aria-label={t('nutrition.plan.logLabel', { name: p.title })}
              disabled={log.isPending}
              onClick={() =>
                log.mutate(p.id, {
                  onSuccess: () => toast(t('nutrition.plan.loggedToast')),
                  onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
                })
              }
            >
              {t('nutrition.plan.logShort')}
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">{t('nutrition.plan.plannedHint')}</p>
    </section>
  )
}
