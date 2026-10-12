import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { decimalToInput, parseDecimal, parseInteger } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { useToast } from '../../ui/toast-context'
import { useNutritionDay, useSaveTarget, type Target } from './api'

/** Por debajo de esto se avisa (sin impedirlo) de que conviene consultarlo con un profesional. */
const LOW_CALORIES = 1200

type Key = keyof Target

/** Objetivos diarios opcionales que fija el usuario. */
export function TargetsForm() {
  const { today } = useDateFormat()
  const day = useNutritionDay(today)
  if (!day.data) return null
  // Se monta una vez con lo guardado; después el formulario conserva lo que escribe el usuario
  return <TargetsFormInner target={day.data.target} />
}

function TargetsFormInner({ target }: { target: Target }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale } = useDateFormat()
  const save = useSaveTarget()
  const [form, setForm] = useState<Record<Key, string>>({
    calories: target.calories == null ? '' : String(target.calories),
    proteinG: decimalToInput(target.proteinG, locale),
    carbsG: decimalToInput(target.carbsG, locale),
    fatG: decimalToInput(target.fatG, locale),
    waterMl: target.waterMl == null ? '' : String(target.waterMl),
  })
  const [showErrors, setShowErrors] = useState(false)

  const values: Record<Key, number | null | undefined> = {
    calories: parseInteger(form.calories),
    proteinG: parseDecimal(form.proteinG, 1, 4),
    carbsG: parseDecimal(form.carbsG, 1, 4),
    fatG: parseDecimal(form.fatG, 1, 4),
    waterMl: parseInteger(form.waterMl),
  }
  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const errorOf = (key: Key) =>
    (showErrors && values[key] === null ? t('nutrition.form.invalidNumber') : undefined) ?? serverErrors[key]

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (Object.values(values).some((v) => v === null)) {
      setShowErrors(true)
      return
    }
    const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ?? null])) as unknown as Target
    save.mutate(body, { onSuccess: () => toast(t('nutrition.targets.saved')) })
  }

  const input = (key: Key, label: string, decimal = true) => (
    <Field label={label} id={`target-${key}`} error={errorOf(key)}>
      <input
        id={`target-${key}`}
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        aria-invalid={Boolean(errorOf(key))}
      />
    </Field>
  )

  return (
    <section className="stack-sm" aria-labelledby="targets-title">
      <h2 id="targets-title" className="h2">
        {t('nutrition.targets.title')}
      </h2>
      <form className="card stack" onSubmit={onSubmit} noValidate>
        <p className="muted small">{t('nutrition.targets.help')}</p>
        <div className="field-row">
          {input('calories', t('nutrition.form.calories'), false)}
          {input('waterMl', t('nutrition.targets.water'), false)}
        </div>
        {values.calories != null && values.calories < LOW_CALORIES && (
          <div className="alert alert-warning" role="status">
            {t('nutrition.targets.lowCalories')}
          </div>
        )}
        <div className="field-row field-row-3">
          {input('proteinG', t('nutrition.form.protein'))}
          {input('carbsG', t('nutrition.form.carbs'))}
          {input('fatG', t('nutrition.form.fat'))}
        </div>
        <p className="hint">{t('nutrition.targets.disclaimer')}</p>
        <div>
          <button type="submit" className="button button-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </section>
  )
}
