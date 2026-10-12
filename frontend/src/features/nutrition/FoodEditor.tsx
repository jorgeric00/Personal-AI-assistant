import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { decimalToInput, parseDecimal, parseInteger } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { MEALS, useDeleteEntry, useSaveEntry, type Entry, type Food, type Meal } from './api'

interface Form {
  meal: Meal
  name: string
  quantity: string
  unit: string
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
  estimated: boolean
}

type NumberField = 'quantity' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'

function toForm(entry: Entry | null, meal: Meal, locale: string): Form {
  const food = entry?.food
  return {
    meal: entry?.meal ?? meal,
    name: food?.name ?? '',
    quantity: decimalToInput(food?.quantity, locale),
    unit: food?.unit ?? '',
    calories: food?.calories == null ? '' : String(food.calories),
    proteinG: decimalToInput(food?.proteinG, locale),
    carbsG: decimalToInput(food?.carbsG, locale),
    fatG: decimalToInput(food?.fatG, locale),
    estimated: food?.estimated ?? false,
  }
}

/** Lee los números del formulario: undefined = vacío, null = no válido. */
function parse(form: Form) {
  return {
    quantity: parseDecimal(form.quantity, 2, 5),
    calories: parseInteger(form.calories),
    proteinG: parseDecimal(form.proteinG, 1, 4),
    carbsG: parseDecimal(form.carbsG, 1, 4),
    fatG: parseDecimal(form.fatG, 1, 4),
  }
}

interface FoodEditorProps {
  entry: Entry | null
  date: string
  meal: Meal
  onClose: () => void
}

/** Alta y edición de un alimento. Solo el nombre es obligatorio; los nutrientes no se rellenan solos. */
export function FoodEditor({ entry, date, meal, onClose }: FoodEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale } = useDateFormat()
  const [form, setForm] = useState(() => toForm(entry, meal, locale))
  const [showErrors, setShowErrors] = useState(false)
  const save = useSaveEntry()
  const remove = useDeleteEntry()

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const numbers = parse(form)
  const invalid = (Object.keys(numbers) as NumberField[]).filter((key) => numbers[key] === null)
  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const errorOf = (key: NumberField | 'name') =>
    (showErrors && invalid.includes(key as NumberField) ? t('nutrition.form.invalidNumber') : undefined) ??
    serverErrors[`food.${key}`]
  const hasNutrients = [numbers.calories, numbers.proteinG, numbers.carbsG, numbers.fatG].some((v) => v != null)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (invalid.length > 0) {
      setShowErrors(true)
      return
    }
    const food: Food = {
      name: form.name.trim(),
      quantity: numbers.quantity ?? null,
      unit: form.unit.trim() || null,
      calories: numbers.calories ?? null,
      proteinG: numbers.proteinG ?? null,
      carbsG: numbers.carbsG ?? null,
      fatG: numbers.fatG ?? null,
      estimated: form.estimated && hasNutrients,
    }
    save.mutate(
      { id: entry?.id, date: entry?.date ?? date, meal: form.meal, food },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          onClose()
        },
      },
    )
  }

  const numberInput = (key: NumberField, label: string, decimal = true) => (
    <Field label={label} id={`food-${key}`} error={errorOf(key)}>
      <input
        id={`food-${key}`}
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={Boolean(errorOf(key))}
      />
    </Field>
  )

  return (
    <Sheet
      title={entry ? t('nutrition.editFood') : t('nutrition.newFood')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="food-form"
            className="button button-primary"
            disabled={save.isPending || !form.name.trim()}
          >
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="food-form" className="stack" onSubmit={onSubmit} noValidate>
        {save.error instanceof ApiError && Object.keys(serverErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {save.error.message}
          </div>
        )}
        {serverErrors.date && (
          <div className="alert alert-error" role="alert">
            {serverErrors.date}
          </div>
        )}
        <Field label={t('nutrition.form.name')} id="food-name" error={errorOf('name')}>
          <input
            id="food-name"
            data-autofocus
            maxLength={120}
            value={form.name}
            placeholder={t('nutrition.form.namePlaceholder')}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label={t('nutrition.form.meal')} id="food-meal">
          <select id="food-meal" value={form.meal} onChange={(e) => set('meal', e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {t(`nutrition.meals.${m}`)}
              </option>
            ))}
          </select>
        </Field>
        <div className="field-row">
          {numberInput('quantity', t('nutrition.form.quantity'))}
          <Field label={t('nutrition.form.unit')} id="food-unit">
            <input
              id="food-unit"
              maxLength={20}
              value={form.unit}
              placeholder={t('nutrition.form.unitPlaceholder')}
              onChange={(e) => set('unit', e.target.value)}
            />
          </Field>
        </div>

        <fieldset className="subform stack">
          <legend className="h3">{t('nutrition.form.nutrientsTitle')}</legend>
          <p className="hint">{t('nutrition.form.nutrientsHelp')}</p>
          <div className="field-row">
            {numberInput('calories', t('nutrition.form.calories'), false)}
            {numberInput('proteinG', t('nutrition.form.protein'))}
          </div>
          <div className="field-row">
            {numberInput('carbsG', t('nutrition.form.carbs'))}
            {numberInput('fatG', t('nutrition.form.fat'))}
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.estimated && hasNutrients}
              disabled={!hasNutrients}
              onChange={(e) => set('estimated', e.target.checked)}
            />
            <span>
              {t('nutrition.form.estimated')}
              <span className="muted small"> · {t('nutrition.form.estimatedHelp')}</span>
            </span>
          </label>
        </fieldset>
      </form>

      {entry && (
        <section className="sheet-section">
          <button
            type="button"
            className="button button-danger-outline"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(entry.id, {
                onSuccess: () => {
                  toast(t('common.deleted'))
                  onClose()
                },
              })
            }
          >
            {t('common.delete')}
          </button>
        </section>
      )}
    </Sheet>
  )
}
