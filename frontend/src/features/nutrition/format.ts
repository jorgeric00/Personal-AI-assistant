import type { TFunction } from 'i18next'

import { formatDecimal } from '../../lib/decimal'
import type { Food } from './api'

/** «60 g · 230 kcal · P 8 · H 39 · G 4,2»: solo lo que está anotado. */
export function foodMeta(food: Food, locale: string, t: TFunction): string {
  const parts: string[] = []
  if (food.quantity != null) parts.push(`${formatDecimal(food.quantity, locale, 2)}${food.unit ? ` ${food.unit}` : ''}`)
  if (food.calories != null) parts.push(t('nutrition.kcal', { value: food.calories }))
  const macros = [
    [t('nutrition.totals.protein'), food.proteinG],
    [t('nutrition.totals.carbs'), food.carbsG],
    [t('nutrition.totals.fat'), food.fatG],
  ] as const
  macros.forEach(([label, value]) => {
    if (value != null) parts.push(`${label.charAt(0)} ${formatDecimal(value, locale, 1)}`)
  })
  return parts.join(' · ')
}
