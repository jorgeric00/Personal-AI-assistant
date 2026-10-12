import { addDays, isoWeekday } from '../../lib/date'
import type { PlannedMeal, SavedMeal } from './api'

/** Valor de ?plan para abrir el formulario de una comida planificada nueva. */
export const NEW_PLAN = 'nuevo'

/** Lunes de la semana de una fecha ISO. */
export function weekStart(iso: string): string {
  return addDays(iso, -(isoWeekday(iso) - 1))
}

export interface ShoppingItem {
  name: string
  unit: string | null
  /** Suma de cantidades; null si algún alimento no tiene cantidad. */
  quantity: number | null
  times: number
}

/**
 * Lista de la compra de lo planificado y aún no registrado: junta los alimentos de las comidas habituales por nombre y
 * unidad. Las comidas sin habitual no tienen alimentos y se devuelven aparte.
 */
export function shoppingList(plans: PlannedMeal[], saved: SavedMeal[]) {
  const byId = new Map(saved.map((meal) => [meal.id, meal]))
  const items = new Map<string, ShoppingItem>()
  const withoutItems: PlannedMeal[] = []
  for (const plan of plans) {
    if (plan.logged) continue
    const meal = plan.savedMealId ? byId.get(plan.savedMealId) : undefined
    if (!meal) {
      withoutItems.push(plan)
      continue
    }
    for (const food of meal.items) {
      const key = `${food.name.trim().toLocaleLowerCase()}|${food.unit ?? ''}`
      const current = items.get(key)
      if (current) {
        current.times += 1
        current.quantity = current.quantity != null && food.quantity != null ? current.quantity + food.quantity : null
      } else {
        items.set(key, { name: food.name.trim(), unit: food.unit, quantity: food.quantity, times: 1 })
      }
    }
  }
  const list = [...items.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { items: list, withoutItems }
}

/**
 * Calorías planificadas de un día según las comidas habituales elegidas. known = cuántas comidas tienen calorías;
 * las demás no suman (no se estiman).
 */
export function plannedCalories(plans: PlannedMeal[], saved: SavedMeal[]) {
  const byId = new Map(saved.map((meal) => [meal.id, meal]))
  let calories = 0
  let known = 0
  let estimated = false
  for (const plan of plans) {
    const meal = plan.savedMealId ? byId.get(plan.savedMealId) : undefined
    if (meal && meal.totals.calories > 0) {
      calories += meal.totals.calories
      known += 1
      estimated ||= meal.totals.estimatedFields.includes('calories')
    }
  }
  return { calories, known, estimated }
}
