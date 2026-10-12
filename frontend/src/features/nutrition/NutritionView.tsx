import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { ApiError } from '../../api/client'
import { addDays, isoWeekday, weekdayNames } from '../../lib/date'
import { formatDecimal } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'
import { useToast } from '../../ui/toast-context'
import { useNutritionDay, useNutritionSummary, useSetWater, type Entry, type Meal, type NutritionDay } from './api'
import { FoodEditor } from './FoodEditor'
import { MealSection } from './MealSection'
import { SavedMealsSheet } from './SavedMealsSheet'
import { TargetsForm } from './TargetsForm'

const WATER_STEP = 250
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Diario de alimentación de un día: lo comido en cada comida, agua, totales frente a los objetivos y resumen de la
 * semana. El día y el formulario abierto viven en la URL (?dia, ?alimento) para el acceso rápido de Hoy.
 */
export function NutritionView() {
  const { t } = useTranslation()
  const { today, relativeDate } = useDateFormat()
  const [params, setParams] = useSearchParams()
  const dayParam = params.get('dia')
  const date = dayParam && ISO_DATE.test(dayParam) && dayParam <= today ? dayParam : today
  const day = useNutritionDay(date)
  const [editing, setEditing] = useState<{ entry: Entry | null; meal: Meal } | null>(null)
  // ?alimento=nuevo abre el formulario (acceso rápido de Hoy y botón de la cabecera)
  const editor = editing ?? (params.get('alimento') === 'nuevo' ? { entry: null, meal: defaultMeal() } : null)
  const [choosingSaved, setChoosingSaved] = useState<Meal | null>(null)

  const goTo = (next: string) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        if (next === today) copy.delete('dia')
        else copy.set('dia', next)
        return copy
      },
      { replace: true },
    )
  const closeEditor = () => {
    setEditing(null)
    if (params.has('alimento')) {
      setParams(
        (current) => {
          const copy = new URLSearchParams(current)
          copy.delete('alimento')
          return copy
        },
        { replace: true },
      )
    }
  }

  return (
    <div className="stack-lg">
      <div className="agenda-nav">
        <button
          type="button"
          className="icon-button"
          aria-label={t('nutrition.previousDay')}
          onClick={() => goTo(addDays(date, -1))}
        >
          <ChevronLeftIcon />
        </button>
        <h2 className="h2" aria-live="polite">
          {relativeDate(date)}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t('nutrition.nextDay')}
          disabled={date >= today}
          onClick={() => goTo(addDays(date, 1))}
        >
          <ChevronRightIcon />
        </button>
      </div>

      {day.isPending ? (
        <div className="card skeleton" aria-hidden="true" />
      ) : day.isError ? (
        <div className="alert alert-error" role="alert">
          {day.error instanceof ApiError ? day.error.message : t('errors.generic')}
        </div>
      ) : (
        <>
          <DayTotals day={day.data} />
          {day.data.meals.map((meal) => (
            <MealSection
              key={`${date}-${meal.meal}`}
              date={date}
              day={meal}
              onAdd={() => setEditing({ entry: null, meal: meal.meal })}
              onOpen={(entry) => setEditing({ entry, meal: entry.meal })}
              onAddSaved={() => setChoosingSaved(meal.meal)}
            />
          ))}
        </>
      )}

      <WeekSummary date={date} />
      <TargetsForm />

      {editor && (
        <FoodEditor
          key={editor.entry?.id ?? 'new'}
          entry={editor.entry}
          date={date}
          meal={editor.meal}
          onClose={closeEditor}
        />
      )}
      {choosingSaved && <SavedMealsSheet date={date} meal={choosingSaved} onClose={() => setChoosingSaved(null)} />}
    </div>
  )
}

/** La comida que toca según la hora, para proponerla al añadir desde Hoy. */
function defaultMeal(): Meal {
  const hour = new Date().getHours()
  if (hour < 11) return 'BREAKFAST'
  if (hour < 17) return 'LUNCH'
  if (hour < 20) return 'SNACK'
  return 'DINNER'
}

function DayTotals({ day }: { day: NutritionDay }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale } = useDateFormat()
  const setWater = useSetWater()
  const { totals, target } = day
  const changeWater = (delta: number) =>
    setWater.mutate(
      { date: day.date, waterMl: Math.max(0, day.waterMl + delta) },
      { onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }) },
    )

  const rows = [
    { key: 'calories', label: t('nutrition.totals.calories'), value: totals.calories, unit: 'kcal' },
    { key: 'proteinG', label: t('nutrition.totals.protein'), value: totals.proteinG, unit: 'g' },
    { key: 'carbsG', label: t('nutrition.totals.carbs'), value: totals.carbsG, unit: 'g' },
    { key: 'fatG', label: t('nutrition.totals.fat'), value: totals.fatG, unit: 'g' },
  ] as const

  return (
    <section className="card stack" aria-labelledby="day-totals-title">
      <h2 id="day-totals-title" className="h3">
        {t('nutrition.totals.title')}
      </h2>
      {totals.entries === 0 ? (
        <p className="muted">{t('nutrition.totals.empty')}</p>
      ) : (
        <>
          <dl className="nutrient-grid">
            {rows.map((row) => (
              <div key={row.label} className="nutrient">
                <dt className="stat-label">{row.label}</dt>
                <dd className="stat-value">
                  {totals.estimatedFields.includes(row.key) && '≈ '}
                  {formatDecimal(row.value, locale, 1)} {row.unit}
                </dd>
                {target[row.key] != null && (
                  <dd className="muted small">
                    {t('nutrition.totals.ofTarget', {
                      target: `${formatDecimal(target[row.key]!, locale, 1)} ${row.unit}`,
                    })}
                    <span className="category-bar-track nutrient-bar" aria-hidden="true">
                      <span
                        className="category-bar-fill"
                        style={{
                          width: `${Math.min(1, row.value / target[row.key]!) * 100}%`,
                          background: 'var(--accent)',
                        }}
                      />
                    </span>
                  </dd>
                )}
              </div>
            ))}
          </dl>
          {(totals.withoutCalories > 0 || totals.estimated) && (
            <p className="hint">
              {[
                totals.withoutCalories > 0 && t('nutrition.totals.withoutCalories', { count: totals.withoutCalories }),
                totals.estimated && t('nutrition.totals.estimated'),
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
          )}
        </>
      )}
      <div className="water-row">
        <span>
          <span className="stat-label">{t('nutrition.water.title')}</span>
          <span className="stat-value">
            {target.waterMl
              ? t('nutrition.water.ofTarget', { value: day.waterMl, target: target.waterMl })
              : t('nutrition.water.amount', { value: day.waterMl })}
          </span>
        </span>
        <span className="water-buttons">
          <button
            type="button"
            className="icon-button"
            aria-label={t('nutrition.water.remove', { ml: WATER_STEP })}
            disabled={day.waterMl === 0 || setWater.isPending}
            onClick={() => changeWater(-WATER_STEP)}
          >
            −
          </button>
          <button
            type="button"
            className="button button-secondary button-small"
            aria-label={t('nutrition.water.add', { ml: WATER_STEP })}
            disabled={setWater.isPending}
            onClick={() => changeWater(WATER_STEP)}
          >
            +{WATER_STEP} ml
          </button>
        </span>
      </div>
    </section>
  )
}

/** Calorías por día de la semana del día elegido, frente al objetivo si existe. Las medias ignoran días vacíos. */
function WeekSummary({ date }: { date: string }) {
  const { t } = useTranslation()
  const { locale, today } = useDateFormat()
  const from = addDays(date, -(isoWeekday(date) - 1))
  const summary = useNutritionSummary(from, addDays(from, 6))
  if (!summary.data) return null
  const { days, target } = summary.data
  const recorded = days.filter((d) => d.totals.entries > 0 || d.waterMl > 0)
  const withFood = days.filter((d) => d.totals.entries > 0)
  const max = Math.max(1, target.calories ?? 0, ...days.map((d) => d.totals.calories))
  const names = weekdayNames(locale, 'narrow')
  const average = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) / values.length)

  return (
    <section className="stack-sm" aria-labelledby="nutrition-week-title">
      <h2 id="nutrition-week-title" className="h2">
        {t('nutrition.week.title')}
      </h2>
      <div className="card stack">
        {recorded.length === 0 ? (
          <p className="muted">{t('nutrition.week.empty')}</p>
        ) : (
          <>
            <div className="kcal-bars" role="img" aria-label={t('nutrition.week.chartLabel')}>
              {days.map((d, i) => (
                <span key={d.date} className={`kcal-bar${d.date === date ? ' is-selected' : ''}`}>
                  <span className="kcal-bar-track">
                    {target.calories != null && (
                      <span className="kcal-bar-target" style={{ bottom: `${(target.calories / max) * 100}%` }} />
                    )}
                    <span className="kcal-bar-fill" style={{ height: `${(d.totals.calories / max) * 100}%` }} />
                  </span>
                  <span className={`week-bar-label${d.date > today ? ' muted' : ''}`}>{names[i]}</span>
                </span>
              ))}
            </div>
            <p>{t('nutrition.week.daysWithRecords', { count: recorded.length })}</p>
            {withFood.some((d) => d.totals.calories > 0) && (
              <p>
                {t('nutrition.week.averageCalories', {
                  value: average(withFood.map((d) => d.totals.calories)),
                })}
              </p>
            )}
            {recorded.some((d) => d.waterMl > 0) && (
              <p>{t('nutrition.week.averageWater', { value: average(recorded.map((d) => d.waterMl)) })}</p>
            )}
            <p className="hint">{t('nutrition.week.averageNote')}</p>
          </>
        )}
      </div>
    </section>
  )
}
