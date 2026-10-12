import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import {
  EXERCISE_TYPES,
  MUSCLE_GROUPS,
  useDeleteExercise,
  useSaveExercise,
  type Exercise,
  type ExerciseType,
  type MuscleGroup,
} from './api'

interface Form {
  name: string
  muscleGroup: MuscleGroup | ''
  type: ExerciseType | ''
  equipment: string
  instructions: string
  safety: string
  archived: boolean
}

/** Alta y edición de un ejercicio del catálogo. */
export function ExerciseEditor({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const save = useSaveExercise()
  const remove = useDeleteExercise()
  const [form, setForm] = useState<Form>({
    name: exercise?.name ?? '',
    muscleGroup: exercise?.muscleGroup ?? '',
    type: exercise?.type ?? '',
    equipment: exercise?.equipment ?? '',
    instructions: exercise?.instructions ?? '',
    safety: exercise?.safety ?? '',
    archived: exercise?.archived ?? false,
  })
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const error = save.error instanceof ApiError ? save.error : null
  const errors: Record<string, string | undefined> = { ...(error?.fieldErrors ?? {}), ...localErrors }
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }))

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) nextErrors.name = t('fitness.exercises.nameRequired')
    if (!form.muscleGroup) nextErrors.muscleGroup = t('fitness.exercises.groupRequired')
    if (!form.type) nextErrors.type = t('fitness.exercises.typeRequired')
    setLocalErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !form.muscleGroup || !form.type) return
    const text = (value: string) => value.trim() || null
    save.mutate(
      {
        id: exercise?.id,
        input: {
          name: form.name.trim(),
          muscleGroup: form.muscleGroup,
          type: form.type,
          equipment: text(form.equipment),
          instructions: text(form.instructions),
          safety: text(form.safety),
          archived: form.archived,
        },
      },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          onClose()
        },
      },
    )
  }

  return (
    <Sheet
      title={exercise ? t('fitness.exercises.edit') : t('fitness.exercises.new')}
      onClose={onClose}
      tall
      footer={
        <>
          <button type="button" className="button button-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="exercise-form" className="button button-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="exercise-form" className="stack" onSubmit={onSubmit} noValidate>
        {error && Object.keys(error.fieldErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {error.message}
          </div>
        )}
        <Field label={t('fitness.exercises.name')} id="exercise-name" error={errors.name}>
          <input
            id="exercise-name"
            maxLength={80}
            autoComplete="off"
            value={form.name}
            aria-invalid={Boolean(errors.name)}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <div className="field-row">
          <Field label={t('fitness.exercises.group')} id="exercise-group" error={errors.muscleGroup}>
            <select
              id="exercise-group"
              value={form.muscleGroup}
              aria-invalid={Boolean(errors.muscleGroup)}
              onChange={(e) => set('muscleGroup', e.target.value as MuscleGroup | '')}
            >
              <option value="">{t('fitness.exercises.choose')}</option>
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {t(`fitness.groups.${g}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('fitness.exercises.type')} id="exercise-type" error={errors.type}>
            <select
              id="exercise-type"
              value={form.type}
              aria-invalid={Boolean(errors.type)}
              onChange={(e) => set('type', e.target.value as ExerciseType | '')}
            >
              <option value="">{t('fitness.exercises.choose')}</option>
              {EXERCISE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`fitness.types.${type}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {form.type && <p className="muted small">{t(`fitness.typeHelp.${form.type}`)}</p>}
        <Field label={t('fitness.exercises.equipment')} id="exercise-equipment" error={errors.equipment}>
          <input
            id="exercise-equipment"
            maxLength={200}
            value={form.equipment}
            placeholder={t('fitness.exercises.equipmentPlaceholder')}
            onChange={(e) => set('equipment', e.target.value)}
          />
        </Field>
        <Field label={t('fitness.exercises.instructions')} id="exercise-instructions" error={errors.instructions}>
          <textarea
            id="exercise-instructions"
            rows={4}
            maxLength={2000}
            value={form.instructions}
            onChange={(e) => set('instructions', e.target.value)}
          />
        </Field>
        <Field label={t('fitness.exercises.safety')} id="exercise-safety" error={errors.safety}>
          <textarea id="exercise-safety" rows={3} maxLength={1000} value={form.safety} onChange={(e) => set('safety', e.target.value)} />
        </Field>
        {exercise && (
          <label className="checkbox-row">
            <input type="checkbox" checked={form.archived} onChange={(e) => set('archived', e.target.checked)} />
            <span>
              {t('fitness.exercises.archive')}
              <span className="muted small checkbox-help">{t('fitness.exercises.archiveHelp')}</span>
            </span>
          </label>
        )}
      </form>

      {exercise && (
        <section className="sheet-section">
          {exercise.inUse ? (
            <p className="muted small">{t('fitness.exercises.inUse')}</p>
          ) : confirmDelete ? (
            <div className="stack" role="alert">
              <p>{t('fitness.exercises.deleteConfirm')}</p>
              <div className="inline-form">
                <button type="button" className="button button-ghost" onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(exercise.id, {
                      onSuccess: () => {
                        toast(t('common.deleted'))
                        onClose()
                      },
                    })
                  }
                >
                  {t('common.confirmDelete')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="button button-danger-outline" onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </button>
          )}
        </section>
      )}
    </Sheet>
  )
}
