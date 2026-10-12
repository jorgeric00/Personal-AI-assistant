import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon } from '../../ui/icons'
import { useToast } from '../../ui/toast-context'
import { useSaveSavedMeal, useSetNote, type Entry, type MealDay } from './api'
import { foodMeta } from './format'

interface MealSectionProps {
  date: string
  day: MealDay
  onAdd: () => void
  onOpen: (entry: Entry) => void
  onAddSaved: () => void
}

/** Una comida del día: sus alimentos, la nota y los atajos de habituales. */
export function MealSection({ date, day, onAdd, onOpen, onAddSaved }: MealSectionProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale } = useDateFormat()
  const setNote = useSetNote()
  const saveMeal = useSaveSavedMeal()
  const [note, setNoteText] = useState(day.note ?? '')
  const [savingAs, setSavingAs] = useState<string | null>(null)
  const mealName = t(`nutrition.meals.${day.meal}`)
  const titleId = `meal-${day.meal}`

  const saveNote = () => {
    if (note.trim() === (day.note ?? '')) return
    setNote.mutate(
      { date, meal: day.meal, note },
      { onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }) },
    )
  }

  const saveAsHabitual = () => {
    if (!savingAs?.trim()) return
    saveMeal.mutate(
      { name: savingAs.trim(), meal: day.meal, items: day.entries.map((e) => e.food) },
      {
        onSuccess: () => {
          setSavingAs(null)
          toast(t('nutrition.saved.savedToast'))
        },
        onError: (e) =>
          toast(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : t('errors.generic'), {
            tone: 'error',
          }),
      },
    )
  }

  return (
    <section className="card stack-sm meal-section" aria-labelledby={titleId}>
      <div className="section-header">
        <h3 id={titleId} className="h3">
          {mealName}
        </h3>
        {day.totals.calories > 0 && (
          <span className="muted small">
            {day.totals.estimatedFields.includes('calories') && '≈ '}
            {t('nutrition.kcal', { value: day.totals.calories })}
          </span>
        )}
      </div>
      {day.entries.length === 0 ? (
        <p className="muted small">{t('nutrition.emptyMeal')}</p>
      ) : (
        <ul className="list-plain food-list">
          {day.entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="food-row" onClick={() => onOpen(entry)}>
                <span className="food-name">{entry.food.name}</span>
                <span className="food-meta">
                  {foodMeta(entry.food, locale, t)}
                  {entry.food.estimated && (
                    <span className="badge badge-estimated">≈ {t('nutrition.estimatedBadge')}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="meal-actions">
        <button
          type="button"
          className="button button-secondary button-small"
          aria-label={t('nutrition.addFoodTo', { meal: mealName })}
          onClick={onAdd}
        >
          <PlusIcon />
          {t('nutrition.addFood')}
        </button>
        <button
          type="button"
          className="button button-ghost button-small"
          aria-label={t('nutrition.fromSavedTo', { meal: mealName })}
          onClick={onAddSaved}
        >
          {t('nutrition.fromSaved')}
        </button>
        {day.entries.length > 0 && savingAs === null && (
          <button type="button" className="link link-button small" onClick={() => setSavingAs(mealName)}>
            {t('nutrition.saved.saveAs')}
          </button>
        )}
      </div>
      {savingAs !== null && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            saveAsHabitual()
          }}
        >
          <input
            aria-label={t('nutrition.saved.name')}
            autoFocus
            maxLength={80}
            value={savingAs}
            onChange={(e) => setSavingAs(e.target.value)}
          />
          <button type="button" className="button button-ghost button-small" onClick={() => setSavingAs(null)}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button-primary button-small" disabled={!savingAs.trim()}>
            {t('common.save')}
          </button>
        </form>
      )}
      <label className="visually-hidden" htmlFor={`${titleId}-note`}>
        {t('nutrition.note', { meal: mealName })}
      </label>
      <textarea
        id={`${titleId}-note`}
        className="meal-note"
        rows={1}
        maxLength={1000}
        value={note}
        placeholder={t('nutrition.notePlaceholder')}
        onChange={(e) => setNoteText(e.target.value)}
        onBlur={saveNote}
      />
    </section>
  )
}
