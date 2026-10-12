import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { Sheet } from '../../ui/Sheet'
import { TrashIcon } from '../../ui/icons'
import { useToast } from '../../ui/toast-context'
import { useDeleteSavedMeal, useLogSavedMeal, useSavedMeals, type Meal } from './api'

interface SavedMealsSheetProps {
  date: string
  meal: Meal
  onClose: () => void
}

/** Elegir una comida habitual para añadirla a una comida del día (o borrar las que ya no se usan). */
export function SavedMealsSheet({ date, meal, onClose }: SavedMealsSheetProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const saved = useSavedMeals()
  const log = useLogSavedMeal()
  const remove = useDeleteSavedMeal()
  const onError = (e: unknown) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' })

  return (
    <Sheet title={t('nutrition.fromSavedTo', { meal: t(`nutrition.meals.${meal}`) })} onClose={onClose}>
      {saved.isPending ? (
        <div className="card skeleton" aria-hidden="true" />
      ) : (saved.data ?? []).length === 0 ? (
        <p className="muted">{t('nutrition.saved.empty')}</p>
      ) : (
        <ul className="list-plain stack-sm" aria-label={t('nutrition.saved.choose')}>
          {saved.data!.map((item) => (
            <li key={item.id} className="saved-meal-row">
              <button
                type="button"
                className="saved-meal-main"
                disabled={log.isPending}
                onClick={() =>
                  log.mutate(
                    { id: item.id, date, meal },
                    {
                      onSuccess: () => {
                        toast(t('nutrition.saved.added', { name: item.name }))
                        onClose()
                      },
                      onError,
                    },
                  )
                }
              >
                <span className="food-name">{item.name}</span>
                <span className="food-meta">
                  {t('nutrition.saved.items', { count: item.items.length })}
                  {item.totals.calories > 0 && ' · '}
                  {item.totals.calories > 0 && item.totals.estimatedFields.includes('calories') && '≈ '}
                  {item.totals.calories > 0 && t('nutrition.kcal', { value: item.totals.calories })}
                </span>
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={t('nutrition.saved.deleteLabel', { name: item.name })}
                onClick={() => remove.mutate(item.id, { onError })}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
