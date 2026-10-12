import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { weekdayNames } from '../../lib/date'
import { decimalToInput, parseDecimal, parseInteger } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from '../../ui/icons'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { WEEKDAYS, type Weekday } from '../tasks/api'
import {
  MUSCLE_GROUPS,
  TARGET_FIELDS,
  useDeleteRoutine,
  useSaveRoutine,
  type Exercise,
  type Routine,
  type RoutineInput,
} from './api'

interface Item {
  key: string
  exerciseId: string
  sets: string
  repsMin: string
  repsMax: string
  weightKg: string
  /** Segundos en ejercicios por tiempo, minutos en cardio. */
  duration: string
  distanceKm: string
  restSeconds: string
  notes: string
}

const str = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value))

function emptyItem(exercise: Exercise): Item {
  return {
    key: crypto.randomUUID(),
    exerciseId: exercise.id,
    sets: exercise.type === 'CARDIO' ? '1' : '3',
    repsMin: '',
    repsMax: '',
    weightKg: '',
    duration: '',
    distanceKm: '',
    restSeconds: '',
    notes: '',
  }
}

interface RoutineEditorProps {
  routine: Routine | null
  exercises: Exercise[]
  onClose: () => void
}

/** Alta y edición de una rutina: nombre, días, y ejercicios en orden con su objetivo. */
export function RoutineEditor({ routine, exercises, onClose }: RoutineEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale } = useDateFormat()
  const save = useSaveRoutine()
  const remove = useDeleteRoutine()
  const byId = new Map(exercises.map((e) => [e.id, e]))

  const [name, setName] = useState(routine?.name ?? '')
  const [notes, setNotes] = useState(routine?.notes ?? '')
  const [weekdays, setWeekdays] = useState<Weekday[]>(routine?.weekdays ?? [])
  const [items, setItems] = useState<Item[]>(
    () =>
      routine?.exercises.map((item) => ({
        key: item.id,
        exerciseId: item.exercise.id,
        sets: String(item.sets),
        repsMin: str(item.repsMin),
        repsMax: str(item.repsMax),
        weightKg: decimalToInput(item.weightKg, locale),
        duration:
          item.durationSeconds === null
            ? ''
            : item.exercise.type === 'CARDIO'
              ? decimalToInput(Math.round((item.durationSeconds / 60) * 10) / 10, locale)
              : String(item.durationSeconds),
        distanceKm: decimalToInput(item.distanceKm, locale),
        restSeconds: str(item.restSeconds),
        notes: item.notes ?? '',
      })) ?? [],
  )
  const [adding, setAdding] = useState('')
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const error = save.error instanceof ApiError ? save.error : null
  const errors: Record<string, string | undefined> = { ...(error?.fieldErrors ?? {}), ...localErrors }
  const dayNames = weekdayNames(locale)
  const available = exercises.filter((e) => !e.archived)

  const updateItem = (index: number, changes: Partial<Item>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...changes } : item)))
  const move = (index: number, delta: number) =>
    setItems((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })

  const addExercise = (id: string) => {
    const exercise = byId.get(id)
    if (exercise) setItems((current) => [...current, emptyItem(exercise)])
    setAdding('')
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = t('fitness.routines.nameRequired')
    if (items.length === 0) nextErrors.exercises = t('fitness.routines.exercisesRequired')
    const parsed: RoutineInput['exercises'] = items.map((item, i) => {
      const exercise = byId.get(item.exerciseId)
      const fields = TARGET_FIELDS[exercise?.type ?? 'STRENGTH']
      const field = (key: string) => `exercises[${i}].${key}`
      const int = (value: string, key: string) => {
        const result = parseInteger(value)
        if (result === null) nextErrors[field(key)] = t('fitness.routines.integerInvalid')
        return result ?? null
      }
      const dec = (value: string, key: string) => {
        const result = parseDecimal(value, 2)
        if (result === null) nextErrors[field(key)] = t('fitness.form.invalidNumber', { count: 2 })
        return result ?? null
      }
      const sets = int(item.sets, 'sets')
      if (sets === null && !nextErrors[field('sets')]) nextErrors[field('sets')] = t('fitness.routines.setsRequired')
      const repsMin = fields.reps ? int(item.repsMin, 'repsMin') : null
      const repsMax = fields.reps ? int(item.repsMax, 'repsMax') : null
      if (repsMin !== null && repsMax !== null && repsMax < repsMin) nextErrors[field('repsMax')] = t('fitness.routines.repsRange')
      let durationSeconds: number | null = null
      if (fields.duration) {
        if (exercise?.type === 'CARDIO') {
          const minutes = parseDecimal(item.duration, 1)
          if (minutes === null) nextErrors[field('durationSeconds')] = t('fitness.form.invalidNumber', { count: 1 })
          durationSeconds = minutes ? Math.round(minutes * 60) : null
        } else {
          durationSeconds = int(item.duration, 'durationSeconds')
        }
      }
      return {
        exerciseId: item.exerciseId,
        sets: sets ?? 0,
        repsMin,
        repsMax,
        weightKg: fields.weight ? dec(item.weightKg, 'weightKg') : null,
        durationSeconds,
        distanceKm: fields.distance ? dec(item.distanceKm, 'distanceKm') : null,
        restSeconds: int(item.restSeconds, 'restSeconds'),
        notes: item.notes.trim() || null,
      }
    })
    setLocalErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    save.mutate(
      {
        id: routine?.id,
        input: { name: name.trim(), notes: notes.trim() || null, weekdays: WEEKDAYS.filter((d) => weekdays.includes(d)), exercises: parsed },
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
      title={routine ? t('fitness.routines.edit') : t('fitness.routines.new')}
      onClose={onClose}
      tall
      footer={
        <>
          <button type="button" className="button button-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="routine-form" className="button button-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="routine-form" className="stack" onSubmit={onSubmit} noValidate>
        {error && Object.keys(error.fieldErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {error.message}
          </div>
        )}
        <Field label={t('fitness.routines.name')} id="routine-name" error={errors.name}>
          <input
            id="routine-name"
            maxLength={80}
            autoComplete="off"
            value={name}
            placeholder={t('fitness.routines.namePlaceholder')}
            aria-invalid={Boolean(errors.name)}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="field">
          <span className="field-label" id="routine-days-label">
            {t('fitness.routines.days')}
          </span>
          <div className="chips" role="group" aria-labelledby="routine-days-label">
            {WEEKDAYS.map((day, index) => (
              <button
                key={day}
                type="button"
                className="chip"
                aria-pressed={weekdays.includes(day)}
                onClick={() => setWeekdays(weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day])}
              >
                {dayNames[index]}
              </button>
            ))}
          </div>
          <p className="muted small">{t('fitness.routines.daysHelp')}</p>
        </div>

        <fieldset className="stack-sm routine-exercises">
          <legend className="field-label">{t('fitness.routines.exercises')}</legend>
          {items.length === 0 && <p className="muted small">{t('fitness.routines.noExercises')}</p>}
          <ol className="list-plain stack-sm">
            {items.map((item, index) => {
              const exercise = byId.get(item.exerciseId)
              const type = exercise?.type ?? 'STRENGTH'
              const fields = TARGET_FIELDS[type]
              const id = (key: string) => `item-${item.key}-${key}`
              const err = (key: string) => errors[`exercises[${index}].${key}`]
              return (
                <li key={item.key} className="routine-item-editor">
                  <div className="routine-item-head">
                    <span className="routine-item-name">
                      {index + 1}. {exercise?.name}
                    </span>
                    <span className="routine-item-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t('fitness.routines.moveUp', { name: exercise?.name })}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ChevronUpIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t('fitness.routines.moveDown', { name: exercise?.name })}
                        disabled={index === items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ChevronDownIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t('fitness.routines.remove', { name: exercise?.name })}
                        onClick={() => setItems(items.filter((_, i) => i !== index))}
                      >
                        <CloseIcon />
                      </button>
                    </span>
                  </div>
                  {err('exerciseId') && <p className="field-error">{err('exerciseId')}</p>}
                  <div className="target-grid">
                    {type !== 'CARDIO' && (
                      <Field label={t('fitness.routines.sets')} id={id('sets')} error={err('sets')}>
                        <input id={id('sets')} inputMode="numeric" value={item.sets} onChange={(e) => updateItem(index, { sets: e.target.value })} />
                      </Field>
                    )}
                    {fields.reps && (
                      <>
                        <Field label={t('fitness.routines.repsMin')} id={id('repsMin')} error={err('repsMin')}>
                          <input id={id('repsMin')} inputMode="numeric" value={item.repsMin} onChange={(e) => updateItem(index, { repsMin: e.target.value })} />
                        </Field>
                        <Field label={t('fitness.routines.repsMax')} id={id('repsMax')} error={err('repsMax')}>
                          <input id={id('repsMax')} inputMode="numeric" value={item.repsMax} onChange={(e) => updateItem(index, { repsMax: e.target.value })} />
                        </Field>
                      </>
                    )}
                    {fields.weight && (
                      <Field label={t('fitness.routines.weightKg')} id={id('weightKg')} error={err('weightKg')}>
                        <input id={id('weightKg')} inputMode="decimal" value={item.weightKg} onChange={(e) => updateItem(index, { weightKg: e.target.value })} />
                      </Field>
                    )}
                    {fields.duration && (
                      <Field
                        label={type === 'CARDIO' ? t('fitness.routines.durationMin') : t('fitness.routines.durationSec')}
                        id={id('durationSeconds')}
                        error={err('durationSeconds')}
                      >
                        <input
                          id={id('durationSeconds')}
                          inputMode={type === 'CARDIO' ? 'decimal' : 'numeric'}
                          value={item.duration}
                          onChange={(e) => updateItem(index, { duration: e.target.value })}
                        />
                      </Field>
                    )}
                    {fields.distance && (
                      <Field label={t('fitness.routines.distanceKm')} id={id('distanceKm')} error={err('distanceKm')}>
                        <input id={id('distanceKm')} inputMode="decimal" value={item.distanceKm} onChange={(e) => updateItem(index, { distanceKm: e.target.value })} />
                      </Field>
                    )}
                    {type !== 'CARDIO' && (
                      <Field label={t('fitness.routines.restSeconds')} id={id('restSeconds')} error={err('restSeconds')}>
                        <input id={id('restSeconds')} inputMode="numeric" value={item.restSeconds} onChange={(e) => updateItem(index, { restSeconds: e.target.value })} />
                      </Field>
                    )}
                  </div>
                  <Field label={t('fitness.routines.itemNotes')} id={id('notes')} error={err('notes')}>
                    <input id={id('notes')} maxLength={500} value={item.notes} onChange={(e) => updateItem(index, { notes: e.target.value })} />
                  </Field>
                </li>
              )
            })}
          </ol>
          {errors.exercises && <p className="field-error">{errors.exercises}</p>}
          <Field label={t('fitness.routines.add')} id="routine-add">
            <select id="routine-add" value={adding} onChange={(e) => addExercise(e.target.value)}>
              <option value="">{t('fitness.routines.choose')}</option>
              {MUSCLE_GROUPS.filter((g) => available.some((e) => e.muscleGroup === g)).map((g) => (
                <optgroup key={g} label={t(`fitness.groups.${g}`)}>
                  {available
                    .filter((e) => e.muscleGroup === g)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </fieldset>

        <Field label={t('fitness.routines.notes')} id="routine-notes" error={errors.notes}>
          <textarea id="routine-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>

      {routine && (
        <section className="sheet-section">
          {confirmDelete ? (
            <div className="stack" role="alert">
              <p>{t('fitness.routines.deleteConfirm')}</p>
              <div className="inline-form">
                <button type="button" className="button button-ghost" onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(routine.id, {
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
