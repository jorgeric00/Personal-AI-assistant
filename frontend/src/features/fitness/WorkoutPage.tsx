import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { ApiError } from '../../api/client'
import { formatDateWithYear } from '../../lib/date'
import { decimalToInput, formatDecimal, parseDecimal, parseInteger } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { CheckIcon, ChevronLeftIcon, CloseIcon, PlusIcon } from '../../ui/icons'
import { useToast } from '../../ui/toast-context'
import {
  MUSCLE_GROUPS,
  TARGET_FIELDS,
  useDeleteWorkout,
  useExercises,
  useSaveWorkout,
  useWorkout,
  type Exercise,
  type ExerciseType,
  type Workout,
  type WorkoutExercise,
  type WorkoutInput,
  type WorkoutSet,
  type WorkoutTarget,
} from './api'
import { formatDuration, formatTarget } from './format'

interface SetState {
  key: string
  reps: string
  weightKg: string
  /** Segundos en ejercicios por tiempo, minutos en cardio. */
  duration: string
  distanceKm: string
  done: boolean
}

interface ExerciseState extends WorkoutTarget {
  key: string
  exercise: WorkoutExercise['exercise']
  notes: string
  sets: SetState[]
  previous: WorkoutExercise['previous']
}

interface State {
  name: string
  date: string
  effort: string
  notes: string
  exercises: ExerciseState[]
}

const noTarget: WorkoutTarget = {
  targetSets: null,
  targetRepsMin: null,
  targetRepsMax: null,
  targetWeightKg: null,
  targetDurationSeconds: null,
  targetDistanceKm: null,
  restSeconds: null,
}

function durationToInput(seconds: number | null, type: ExerciseType, locale: string) {
  if (seconds === null) return ''
  return type === 'CARDIO' ? decimalToInput(Math.round((seconds / 60) * 10) / 10, locale) : String(seconds)
}

function toSetState(set: WorkoutSet, type: ExerciseType, locale: string): SetState {
  return {
    key: crypto.randomUUID(),
    reps: set.reps === null ? '' : String(set.reps),
    weightKg: decimalToInput(set.weightKg, locale),
    duration: durationToInput(set.durationSeconds, type, locale),
    distanceKm: decimalToInput(set.distanceKm, locale),
    done: set.done,
  }
}

function toState(workout: Workout, locale: string): State {
  return {
    name: workout.name,
    date: workout.date,
    effort: workout.effort === null ? '' : String(workout.effort),
    notes: workout.notes ?? '',
    exercises: workout.exercises.map((item) => ({
      key: item.id,
      exercise: item.exercise,
      targetSets: item.targetSets,
      targetRepsMin: item.targetRepsMin,
      targetRepsMax: item.targetRepsMax,
      targetWeightKg: item.targetWeightKg,
      targetDurationSeconds: item.targetDurationSeconds,
      targetDistanceKm: item.targetDistanceKm,
      restSeconds: item.restSeconds,
      notes: item.notes ?? '',
      sets: item.sets.map((set) => toSetState(set, item.exercise.type, locale)),
      previous: item.previous,
    })),
  }
}

/** Convierte el estado en la petición; devuelve también los errores de los campos mal escritos. */
function toInput(state: State, finished: boolean): { input: WorkoutInput; errors: Record<string, true> } {
  const errors: Record<string, true> = {}
  const exercises = state.exercises.map((item, i) => {
    const fields = TARGET_FIELDS[item.exercise.type]
    const sets = item.sets.map((set, j) => {
      const key = (field: string) => `exercises[${i}].sets[${j}].${field}`
      const check = <T,>(value: T | null | undefined, field: string) => {
        if (value === null) errors[key(field)] = true
        return value ?? null
      }
      const reps = fields.reps ? check(parseInteger(set.reps), 'reps') : null
      const weightKg = fields.weight ? check(parseDecimal(set.weightKg, 2), 'weightKg') : null
      let durationSeconds: number | null = null
      if (fields.duration) {
        if (item.exercise.type === 'CARDIO') {
          const minutes = check(parseDecimal(set.duration, 1), 'durationSeconds')
          durationSeconds = minutes ? Math.round(minutes * 60) : null
        } else {
          durationSeconds = check(parseInteger(set.duration), 'durationSeconds')
        }
      }
      const distanceKm = fields.distance ? check(parseDecimal(set.distanceKm, 2), 'distanceKm') : null
      return { reps, weightKg, durationSeconds, distanceKm, done: set.done }
    })
    const { key: _key, exercise, previous: _previous, sets: _sets, notes, ...target } = item
    return { ...target, exerciseId: exercise.id, notes: notes.trim() || null, sets }
  })
  return {
    input: {
      name: state.name.trim(),
      date: state.date,
      effort: state.effort ? Number(state.effort) : null,
      notes: state.notes.trim() || null,
      finished,
      exercises,
    },
    errors,
  }
}

/** Una serie como «8 × 60 kg», «45 s» o «20 min · 3,5 km». */
function formatSet(set: WorkoutSet, type: ExerciseType, locale: string) {
  const parts: string[] = []
  if (set.reps !== null) parts.push(set.weightKg ? `${set.reps} × ${formatDecimal(set.weightKg, locale, 2)} kg` : String(set.reps))
  else if (set.weightKg) parts.push(`${formatDecimal(set.weightKg, locale, 2)} kg`)
  if (set.durationSeconds !== null) parts.push(formatDuration(set.durationSeconds))
  if (type === 'CARDIO' && set.distanceKm !== null) parts.push(`${formatDecimal(set.distanceKm, locale, 2)} km`)
  return parts.join(' · ')
}

const AUTOSAVE_MS = 1000

/** Sesión de entrenamiento: anotar series, marcarlas como hechas y terminar. Se guarda sola mientras se edita. */
export function WorkoutPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const workout = useWorkout(id)
  const exercises = useExercises()
  const { locale } = useDateFormat()

  if (workout.isPending || exercises.isPending) {
    return (
      <div className="page screen-center-inline" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    )
  }
  if (workout.isError || exercises.isError) {
    return (
      <div className="page stack">
        <div className="alert alert-error" role="alert">
          {(workout.error ?? exercises.error)?.message}
        </div>
        <Link to="/entreno" className="link">
          {t('fitness.workouts.back')}
        </Link>
      </div>
    )
  }
  // El estado se crea una vez por entrenamiento: guardar no lo reinicia.
  return <WorkoutEditor key={id} workout={workout.data} exercises={exercises.data} locale={locale} />
}

function WorkoutEditor({ workout, exercises, locale }: { workout: Workout; exercises: Exercise[]; locale: string }) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { today } = useDateFormat()
  const save = useSaveWorkout()
  const remove = useDeleteWorkout()
  const [state, setState] = useState<State>(() => toState(workout, locale))
  const [finished, setFinished] = useState(workout.finished)
  const [dirty, setDirty] = useState(false)
  const [adding, setAdding] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { errors: localErrors } = toInput(state, finished)
  const error = save.error instanceof ApiError ? save.error : null
  const serverErrors = error?.fieldErrors ?? {}

  const change = (updater: (current: State) => State) => {
    setState(updater)
    setDirty(true)
  }
  const updateExercise = (index: number, changes: Partial<ExerciseState>) =>
    change((s) => ({ ...s, exercises: s.exercises.map((e, i) => (i === index ? { ...e, ...changes } : e)) }))
  const updateSet = (index: number, setIndex: number, changes: Partial<SetState>) =>
    change((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) =>
        i === index ? { ...e, sets: e.sets.map((set, j) => (j === setIndex ? { ...set, ...changes } : set)) } : e,
      ),
    }))

  const hasValues = (set: SetState) => Boolean(set.reps || set.weightKg || set.duration || set.distanceKm)

  // Al marcar una serie como hecha, la siguiente vacía parte de sus valores (sin darla por hecha).
  const toggleDone = (index: number, setIndex: number) =>
    change((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => {
        if (i !== index) return e
        const current = e.sets[setIndex]
        return {
          ...e,
          sets: e.sets.map((set, j) => {
            if (j === setIndex) return { ...set, done: !set.done }
            if (j === setIndex + 1 && !current.done && !set.done && !hasValues(set)) {
              return { ...set, reps: current.reps, weightKg: current.weightKg, duration: current.duration, distanceKm: current.distanceKm }
            }
            return set
          }),
        }
      }),
    }))

  // Guardado automático tras un momento sin cambios, si no hay valores mal escritos.
  const saveMutate = save.mutate
  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      const { input, errors } = toInput(state, finished)
      if (Object.keys(errors).length > 0 || !input.name) return
      setDirty(false)
      saveMutate({ id: workout.id, input })
    }, AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [state, dirty, finished, saveMutate, workout.id])

  const finish = (value: boolean) => {
    const { input, errors } = toInput(state, value)
    if (Object.keys(errors).length > 0) return
    setDirty(false)
    save.mutate(
      { id: workout.id, input },
      {
        onSuccess: () => {
          setFinished(value)
          if (value) {
            toast(t('fitness.workouts.finishedToast'))
            navigate('/entreno')
          }
        },
      },
    )
  }

  const addExercise = (exerciseId: string) => {
    const exercise = exercises.find((e) => e.id === exerciseId)
    setAdding('')
    if (!exercise) return
    change((s) => ({
      ...s,
      exercises: [
        ...s.exercises,
        {
          ...noTarget,
          key: crypto.randomUUID(),
          exercise: { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup, type: exercise.type, archived: exercise.archived },
          notes: '',
          sets: [{ key: crypto.randomUUID(), reps: '', weightKg: '', duration: '', distanceKm: '', done: false }],
          previous: null,
        },
      ],
    }))
  }

  const available = exercises.filter((e) => !e.archived)
  const doneSets = state.exercises.reduce((sum, e) => sum + e.sets.filter((s) => s.done).length, 0)
  const status = save.isPending ? t('common.saving') : dirty ? t('fitness.workouts.unsaved') : save.isSuccess ? t('fitness.workouts.saved') : ''

  return (
    <div className="page stack-lg workout-page">
      <header className="stack-sm">
        <Link to="/entreno" className="link back-link">
          <ChevronLeftIcon />
          {t('fitness.title')}
        </Link>
        <div className="page-header-row">
          <h1 className="h1 workout-title">{state.name || t('fitness.workouts.untitled')}</h1>
          <span className={`badge ${finished ? 'badge-success' : 'badge-accent'}`}>
            {finished ? t('fitness.workouts.finished') : t('fitness.workouts.inProgress')}
          </span>
        </div>
        <p className="muted small" role="status" aria-live="polite">
          {t('fitness.workouts.doneSets', { count: doneSets })}
          {status && ` · ${status}`}
        </p>
      </header>

      {error && Object.keys(error.fieldErrors).length === 0 && (
        <div className="alert alert-error" role="alert">
          {error.message}
        </div>
      )}
      {serverErrors.exercises && (
        <div className="alert alert-error" role="alert">
          {serverErrors.exercises}
        </div>
      )}

      <div className="field-row">
        <Field label={t('fitness.workouts.name')} id="workout-name" error={serverErrors.name}>
          <input id="workout-name" maxLength={80} value={state.name} onChange={(e) => change((s) => ({ ...s, name: e.target.value }))} />
        </Field>
        <Field label={t('fitness.form.date')} id="workout-date" error={serverErrors.date}>
          <input
            id="workout-date"
            type="date"
            max={today}
            value={state.date}
            onChange={(e) => e.target.value && change((s) => ({ ...s, date: e.target.value }))}
          />
        </Field>
      </div>

      {state.exercises.length === 0 && <p className="card empty-state muted">{t('fitness.workouts.noExercises')}</p>}

      <ol className="list-plain stack">
        {state.exercises.map((item, index) => {
          const type = item.exercise.type
          const fields = TARGET_FIELDS[type]
          const hasTarget = item.targetSets !== null
          const setLabel = (n: number) => t('fitness.workouts.setNumber', { n })
          return (
            <li key={item.key} className="card stack-sm workout-exercise">
              <div className="routine-item-head">
                <h2 className="h3">{item.exercise.name}</h2>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('fitness.routines.remove', { name: item.exercise.name })}
                  onClick={() => change((s) => ({ ...s, exercises: s.exercises.filter((_, i) => i !== index) }))}
                >
                  <CloseIcon />
                </button>
              </div>
              {hasTarget && (
                <p className="small">
                  <span className="muted">{t('fitness.workouts.target')}: </span>
                  {formatTarget(
                    type,
                    {
                      sets: item.targetSets ?? 1,
                      repsMin: item.targetRepsMin,
                      repsMax: item.targetRepsMax,
                      weightKg: item.targetWeightKg,
                      durationSeconds: item.targetDurationSeconds,
                      distanceKm: item.targetDistanceKm,
                      restSeconds: item.restSeconds,
                      notes: null,
                    },
                    t,
                    locale,
                  )}
                </p>
              )}
              {item.notes && <p className="muted small entry-notes">{item.notes}</p>}
              <p className="small previous">
                {item.previous
                  ? t('fitness.workouts.previous', {
                      date: formatDateWithYear(item.previous.date, locale),
                      sets: item.previous.sets.map((s) => formatSet(s, type, locale)).join(', '),
                    })
                  : t('fitness.workouts.noPrevious')}
              </p>

              <table className="set-table">
                <thead>
                  <tr>
                    <th scope="col">{t('fitness.workouts.set')}</th>
                    {fields.reps && <th scope="col">{t('fitness.workouts.reps')}</th>}
                    {fields.weight && <th scope="col">kg</th>}
                    {fields.duration && <th scope="col">{type === 'CARDIO' ? 'min' : 's'}</th>}
                    {fields.distance && <th scope="col">km</th>}
                    <th scope="col">
                      <span className="visually-hidden">{t('fitness.workouts.done')}</span>
                    </th>
                    <th scope="col">
                      <span className="visually-hidden">{t('common.delete')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {item.sets.map((set, j) => {
                    const invalid = (field: string) =>
                      Boolean(localErrors[`exercises[${index}].sets[${j}].${field}`] || serverErrors[`exercises[${index}].sets[${j}].${field}`])
                    const input = (field: 'reps' | 'weightKg' | 'duration' | 'distanceKm', label: string, errorField: string, decimal: boolean) => (
                      <td>
                        <input
                          aria-label={`${label}, ${setLabel(j + 1)}`}
                          inputMode={decimal ? 'decimal' : 'numeric'}
                          autoComplete="off"
                          value={set[field]}
                          aria-invalid={invalid(errorField)}
                          onChange={(e) => updateSet(index, j, { [field]: e.target.value })}
                        />
                      </td>
                    )
                    return (
                      <tr key={set.key} className={set.done ? 'set-done' : undefined}>
                        <th scope="row">{j + 1}</th>
                        {fields.reps && input('reps', t('fitness.workouts.reps'), 'reps', false)}
                        {fields.weight && input('weightKg', t('fitness.routines.weightKg'), 'weightKg', true)}
                        {fields.duration &&
                          input(
                            'duration',
                            type === 'CARDIO' ? t('fitness.routines.durationMin') : t('fitness.routines.durationSec'),
                            'durationSeconds',
                            type === 'CARDIO',
                          )}
                        {fields.distance && input('distanceKm', t('fitness.routines.distanceKm'), 'distanceKm', true)}
                        <td>
                          <button
                            type="button"
                            className="set-check"
                            aria-pressed={set.done}
                            aria-label={t('fitness.workouts.markDone', { n: j + 1 })}
                            onClick={() => toggleDone(index, j)}
                          >
                            <CheckIcon />
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={t('fitness.workouts.removeSet', { n: j + 1 })}
                            onClick={() => updateExercise(index, { sets: item.sets.filter((_, k) => k !== j) })}
                          >
                            <CloseIcon />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {item.sets.some((_, j) => serverErrors[`exercises[${index}].sets[${j}]`]) && (
                <p className="field-error">
                  {item.sets.map((_, j) => serverErrors[`exercises[${index}].sets[${j}]`]).find(Boolean)}
                </p>
              )}
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  // La nueva serie parte de los valores de la última anotada, sin marcar como hecha.
                  const last = [...item.sets].reverse().find(hasValues)
                  updateExercise(index, {
                    sets: [
                      ...item.sets,
                      last
                        ? { ...last, key: crypto.randomUUID(), done: false }
                        : { key: crypto.randomUUID(), reps: '', weightKg: '', duration: '', distanceKm: '', done: false },
                    ],
                  })
                }}
              >
                <PlusIcon />
                {t('fitness.workouts.addSet')}
              </button>
            </li>
          )
        })}
      </ol>

      <Field label={t('fitness.workouts.addExercise')} id="workout-add">
        <select id="workout-add" value={adding} onChange={(e) => addExercise(e.target.value)}>
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

      <section className="card stack" aria-labelledby="workout-close">
        <h2 id="workout-close" className="h3">
          {t('fitness.workouts.howItWent')}
        </h2>
        <Field label={t('fitness.workouts.effort')} id="workout-effort" error={serverErrors.effort}>
          <select id="workout-effort" value={state.effort} onChange={(e) => change((s) => ({ ...s, effort: e.target.value }))}>
            <option value="">{t('fitness.profile.notSet')}</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {t('fitness.workouts.effortValue', { n })}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('fitness.workouts.notes')} id="workout-notes" error={serverErrors.notes}>
          <textarea
            id="workout-notes"
            rows={3}
            maxLength={2000}
            value={state.notes}
            placeholder={t('fitness.form.notesPlaceholder')}
            onChange={(e) => change((s) => ({ ...s, notes: e.target.value }))}
          />
        </Field>
        <p className="muted small">{t('fitness.workouts.finishHelp')}</p>
        <div className="form-actions">
          {finished ? (
            <button type="button" className="button button-secondary" disabled={save.isPending} onClick={() => finish(false)}>
              {t('fitness.workouts.reopen')}
            </button>
          ) : (
            <button type="button" className="button button-primary" disabled={save.isPending || doneSets === 0} onClick={() => finish(true)}>
              {t('fitness.workouts.finish')}
            </button>
          )}
        </div>
      </section>

      <section className="sheet-section">
        {confirmDelete ? (
          <div className="stack" role="alert">
            <p>{t('fitness.workouts.deleteConfirm')}</p>
            <div className="inline-form">
              <button type="button" className="button button-ghost" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(workout.id, {
                    onSuccess: () => {
                      toast(t('common.deleted'))
                      navigate('/entreno')
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
            {t('fitness.workouts.delete')}
          </button>
        )}
      </section>
    </div>
  )
}
