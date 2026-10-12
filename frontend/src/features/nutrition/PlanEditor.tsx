import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import {
  MEALS,
  useDeletePlan,
  useLogPlan,
  useSavePlan,
  type Meal,
  type PlannedMeal,
  type SavedMeal,
} from './api'

interface PlanEditorProps {
  plan: PlannedMeal | null
  date: string
  meal: Meal
  savedMeals: SavedMeal[]
  onClose: () => void
}

/** Alta y edición de una comida planificada; desde aquí también se pasa al diario. */
export function PlanEditor({ plan, date, meal, savedMeals, onClose }: PlanEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { today } = useDateFormat()
  const [form, setForm] = useState(() => ({
    date: plan?.date ?? date,
    meal: plan?.meal ?? meal,
    savedMealId: plan?.savedMealId ?? '',
    title: plan?.title ?? '',
    notes: plan?.notes ?? '',
    prepDate: plan?.prepDate ?? '',
  }))
  const save = useSavePlan()
  const remove = useDeletePlan()
  const log = useLogPlan()
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const saved = savedMeals.find((m) => m.id === form.savedMealId)
  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const prepAfter = form.prepDate !== '' && form.date !== '' && form.prepDate > form.date
  const canSave = form.date !== '' && (form.title.trim() !== '' || saved != null) && !prepAfter
  const onError = (e: unknown) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    save.mutate(
      {
        id: plan?.id,
        date: form.date,
        meal: form.meal,
        title: form.title.trim() || null,
        savedMealId: saved?.id ?? null,
        notes: form.notes.trim() || null,
        prepDate: form.prepDate || null,
      },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          onClose()
        },
      },
    )
  }

  const chooseSaved = (id: string) => {
    const next = savedMeals.find((m) => m.id === id)
    setForm((f) => ({
      ...f,
      savedMealId: id,
      // El título sigue al de la habitual salvo que se haya escrito otro
      title: !f.title.trim() || savedMeals.some((m) => m.name === f.title) ? (next?.name ?? '') : f.title,
      meal: !plan && next?.meal ? next.meal : f.meal,
    }))
  }

  return (
    <Sheet
      title={plan ? t('nutrition.plan.edit') : t('nutrition.plan.new')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="plan-form" className="button button-primary" disabled={save.isPending || !canSave}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="plan-form" className="stack" onSubmit={onSubmit} noValidate>
        {save.error instanceof ApiError && Object.keys(serverErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {save.error.message}
          </div>
        )}
        {plan?.logged && <p className="hint">{t('nutrition.plan.loggedHint')}</p>}
        <div className="field-row">
          <Field label={t('nutrition.plan.date')} id="plan-date" error={serverErrors.date}>
            <input id="plan-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label={t('nutrition.form.meal')} id="plan-meal">
            <select id="plan-meal" value={form.meal} onChange={(e) => set('meal', e.target.value as Meal)}>
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {t(`nutrition.meals.${m}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t('nutrition.plan.savedMeal')} id="plan-saved" error={serverErrors.savedMealId}>
          <select id="plan-saved" value={form.savedMealId} onChange={(e) => chooseSaved(e.target.value)}>
            <option value="">{t('nutrition.plan.noSavedMeal')}</option>
            {savedMeals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('nutrition.plan.title')} id="plan-title" error={serverErrors.title}>
          <input
            id="plan-title"
            data-autofocus
            maxLength={120}
            value={form.title}
            placeholder={saved?.name ?? t('nutrition.plan.titlePlaceholder')}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field label={t('nutrition.plan.notes')} id="plan-notes" error={serverErrors.notes}>
          <textarea
            id="plan-notes"
            rows={2}
            maxLength={500}
            value={form.notes}
            placeholder={t('nutrition.plan.notesPlaceholder')}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
        <Field
          label={t('nutrition.plan.prepDate')}
          id="plan-prep"
          error={prepAfter ? t('nutrition.plan.prepAfter') : serverErrors.prepDate}
        >
          <input
            id="plan-prep"
            type="date"
            value={form.prepDate}
            max={form.date || undefined}
            aria-invalid={prepAfter}
            onChange={(e) => set('prepDate', e.target.value)}
          />
        </Field>
        <p className="hint">{t('nutrition.plan.prepHelp')}</p>
      </form>

      {plan && (
        <section className="sheet-section stack-sm">
          {!plan.logged && (
            <>
              <button
                type="button"
                className="button button-secondary"
                disabled={log.isPending || plan.date > today}
                onClick={() =>
                  log.mutate(plan.id, {
                    onSuccess: () => {
                      toast(t('nutrition.plan.loggedToast'))
                      onClose()
                    },
                    onError,
                  })
                }
              >
                {t('nutrition.plan.log')}
              </button>
              <p className="hint">{plan.date > today ? t('nutrition.plan.logFuture') : t('nutrition.plan.logHelp')}</p>
            </>
          )}
          <button
            type="button"
            className="button button-danger-outline"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(plan.id, {
                onSuccess: () => {
                  toast(t('common.deleted'))
                  onClose()
                },
                onError,
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
