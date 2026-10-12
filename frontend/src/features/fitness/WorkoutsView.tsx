import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { addDays, formatDateWithYear, isoWeekday } from '../../lib/date'
import { formatDecimal } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon } from '../../ui/icons'
import { WEEKDAYS } from '../tasks/api'
import { useProfile, useRecords, useRoutines, useStartWorkout, useWorkouts, type ExerciseRecord, type WorkoutSummary } from './api'
import { formatDuration } from './format'

const WEEKS = 8

/** Lunes de la semana de una fecha ISO. */
function weekStart(iso: string) {
  return addDays(iso, -(isoWeekday(iso) - 1))
}

/**
 * Entrenamientos: lo que toca hoy, empezar uno, constancia de las últimas semanas, récords e historial. Solo
 * cuentan los entrenamientos terminados con alguna serie hecha.
 */
export function WorkoutsView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { locale, today } = useDateFormat()
  const workouts = useWorkouts()
  const routines = useRoutines()
  const profile = useProfile()
  const records = useRecords()
  const start = useStartWorkout()
  const [pastDate, setPastDate] = useState<string | null>(null)

  if (workouts.isPending || routines.isPending) {
    return (
      <div className="screen-center-inline" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    )
  }
  if (workouts.isError || routines.isError) {
    return (
      <div className="alert alert-error" role="alert">
        {(workouts.error ?? routines.error)?.message}
      </div>
    )
  }

  const begin = (routineId: string | null, date: string | null = null) =>
    start.mutate({ routineId, date }, { onSuccess: (workout) => navigate(`/entreno/sesion/${workout.id}`) })

  const todayName = WEEKDAYS[isoWeekday(today) - 1]
  const inProgress = workouts.data.filter((w) => !w.finished)
  const finished = workouts.data.filter((w) => w.finished)
  const scheduled = routines.data.filter((r) => r.weekdays.includes(todayName))
  const others = routines.data.filter((r) => !r.weekdays.includes(todayName))
  const doneToday = finished.some((w) => w.date === today)

  return (
    <div className="stack-lg">
      {start.isError && (
        <div className="alert alert-error" role="alert">
          {start.error.message}
        </div>
      )}

      {inProgress.length > 0 && (
        <section className="stack-sm" aria-labelledby="in-progress-title">
          <h2 id="in-progress-title" className="h2">
            {t('fitness.workouts.inProgressTitle')}
          </h2>
          <ul className="card list-plain movement-list">
            {inProgress.map((w) => (
              <li key={w.id}>
                <button type="button" className="movement-row" onClick={() => navigate(`/entreno/sesion/${w.id}`)}>
                  <span className="movement-main">
                    <span className="movement-title">{w.name}</span>
                    <span className="movement-meta">
                      {formatDateWithYear(w.date, locale)} · {t('fitness.workouts.doneSets', { count: w.doneSets })}
                    </span>
                  </span>
                  <span className="button button-primary button-small">{t('fitness.workouts.continue')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack-sm" aria-labelledby="start-title">
        <h2 id="start-title" className="h2">
          {scheduled.length > 0 ? t('fitness.workouts.todayTitle') : t('fitness.workouts.startTitle')}
        </h2>
        {doneToday && <p className="alert alert-info">{t('fitness.workouts.doneToday')}</p>}
        {routines.data.length === 0 && <p className="muted small">{t('fitness.workouts.noRoutines')}</p>}
        <ul className="card list-plain movement-list">
          {[...scheduled, ...others].map((routine) => (
            <li key={routine.id}>
              <div className="movement-row">
                <span className="movement-main">
                  <span className="movement-title">{routine.name}</span>
                  <span className="movement-meta">
                    {scheduled.includes(routine) && <span className="badge badge-accent">{t('fitness.workouts.today')}</span>}
                    {t('fitness.workouts.exerciseCount', { count: routine.exercises.length })}
                  </span>
                </span>
                <button
                  type="button"
                  className={`button button-small ${scheduled.includes(routine) ? 'button-primary' : 'button-secondary'}`}
                  aria-label={t('fitness.workouts.startNamed', { name: routine.name })}
                  disabled={start.isPending}
                  onClick={() => begin(routine.id)}
                >
                  {t('fitness.workouts.start')}
                </button>
              </div>
            </li>
          ))}
          <li>
            <div className="movement-row">
              <span className="movement-main">
                <span className="movement-title">{t('fitness.workouts.freeTitle')}</span>
                <span className="movement-meta">{t('fitness.workouts.freeHelp')}</span>
              </span>
              <button
                type="button"
                className="button button-secondary button-small"
                aria-label={t('fitness.workouts.startFree')}
                disabled={start.isPending}
                onClick={() => begin(null)}
              >
                {t('fitness.workouts.start')}
              </button>
            </div>
          </li>
        </ul>
        {pastDate === null ? (
          <button type="button" className="link link-button" onClick={() => setPastDate(addDays(today, -1))}>
            {t('fitness.workouts.logPast')}
          </button>
        ) : (
          <form
            className="card stack-sm"
            onSubmit={(e) => {
              e.preventDefault()
              const routineId = new FormData(e.currentTarget).get('routine') as string
              begin(routineId || null, pastDate)
            }}
          >
            <div className="field-row">
              <div className="field">
                <label htmlFor="past-date">{t('fitness.form.date')}</label>
                <input id="past-date" type="date" max={today} value={pastDate} onChange={(e) => setPastDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="past-routine">{t('fitness.workouts.routine')}</label>
                <select id="past-routine" name="routine" defaultValue="">
                  <option value="">{t('fitness.workouts.freeTitle')}</option>
                  {routines.data.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="inline-form">
              <button type="button" className="button button-ghost button-small" onClick={() => setPastDate(null)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="button button-primary button-small" disabled={start.isPending || !pastDate}>
                <PlusIcon />
                {t('fitness.workouts.logPastSubmit')}
              </button>
            </div>
          </form>
        )}
      </section>

      <Consistency finished={finished} today={today} target={profile.data?.daysPerWeek ?? null} locale={locale} />

      {records.data && records.data.length > 0 && (
        <section className="stack-sm" aria-labelledby="records-title">
          <h2 id="records-title" className="h2">
            {t('fitness.records.title')}
          </h2>
          <ul className="card list-plain movement-list">
            {records.data.map((record) => (
              <RecordRow key={record.exerciseId} record={record} locale={locale} />
            ))}
          </ul>
        </section>
      )}

      <section className="stack-sm" aria-labelledby="workout-history-title">
        <h2 id="workout-history-title" className="h2">
          {t('fitness.history')}
        </h2>
        {finished.length === 0 ? (
          <div className="card empty-state">
            <p className="muted">{t('fitness.workouts.empty')}</p>
          </div>
        ) : (
          <ul className="card list-plain movement-list">
            {finished.map((w) => (
              <li key={w.id}>
                <button type="button" className="movement-row" onClick={() => navigate(`/entreno/sesion/${w.id}`)}>
                  <span className="movement-main">
                    <span className="movement-title">{w.name}</span>
                    <span className="movement-meta">
                      {formatDateWithYear(w.date, locale)} · {t('fitness.workouts.exerciseCount', { count: w.exerciseCount })} ·{' '}
                      {t('fitness.workouts.doneSets', { count: w.doneSets })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** Entrenamientos terminados por semana (de lunes a domingo), con el objetivo del perfil si lo hay. */
function Consistency({ finished, today, target, locale }: { finished: WorkoutSummary[]; today: string; target: number | null; locale: string }) {
  const { t } = useTranslation()
  const current = weekStart(today)
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(current, -7 * (WEEKS - 1 - i)))
  // Días distintos con entrenamiento terminado: dos sesiones el mismo día cuentan como un día.
  const counts = weeks.map((start) => new Set(finished.filter((w) => weekStart(w.date) === start).map((w) => w.date)).size)
  const max = Math.max(target ?? 0, ...counts, 1)
  const thisWeek = counts[counts.length - 1]
  return (
    <section className="card stack-sm" aria-labelledby="consistency-title">
      <h2 id="consistency-title" className="h3">
        {t('fitness.consistency.title')}
      </h2>
      <p>
        {target
          ? t('fitness.consistency.thisWeekTarget', { count: thisWeek, target })
          : t('fitness.consistency.thisWeek', { count: thisWeek })}
      </p>
      <div className="week-bars" aria-hidden="true">
        {weeks.map((start, i) => (
          <span key={start} className="week-bar">
            <span className="week-bar-track">
              <span
                className={`week-bar-fill${target && counts[i] >= target ? ' week-bar-met' : ''}`}
                style={{ height: `${(counts[i] / max) * 100}%` }}
              />
            </span>
            <span className="week-bar-label">{counts[i]}</span>
          </span>
        ))}
      </div>
      <table className="visually-hidden">
        <thead>
          <tr>
            <th>{t('fitness.consistency.week')}</th>
            <th>{t('fitness.consistency.days')}</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((start, i) => (
            <tr key={start}>
              <td>{formatDateWithYear(start, locale)}</td>
              <td>{counts[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        {target ? t('fitness.consistency.help', { from: formatDateWithYear(weeks[0], locale) }) : t('fitness.consistency.noTarget')}
      </p>
    </section>
  )
}

function RecordRow({ record, locale }: { record: ExerciseRecord; locale: string }) {
  const { t } = useTranslation()
  const parts: string[] = []
  if (record.bestWeightKg !== null) {
    parts.push(
      t('fitness.records.weight', {
        value: `${formatDecimal(record.bestWeightKg, locale, 2)} kg${record.bestWeightReps ? ` × ${record.bestWeightReps}` : ''}`,
        date: formatDateWithYear(record.bestWeightDate!, locale),
      }),
    )
  }
  if (record.bestReps !== null && record.type !== 'STRENGTH') {
    parts.push(t('fitness.records.reps', { value: record.bestReps, date: formatDateWithYear(record.bestRepsDate!, locale) }))
  }
  if (record.longestDurationSeconds !== null) {
    parts.push(
      t('fitness.records.duration', {
        value: formatDuration(record.longestDurationSeconds),
        date: formatDateWithYear(record.longestDurationDate!, locale),
      }),
    )
  }
  if (record.longestDistanceKm !== null) {
    parts.push(
      t('fitness.records.distance', {
        value: `${formatDecimal(record.longestDistanceKm, locale, 2)} km`,
        date: formatDateWithYear(record.longestDistanceDate!, locale),
      }),
    )
  }
  return (
    <li className="movement-row">
      <span className="movement-main">
        <span className="movement-title">{record.exerciseName}</span>
        {parts.map((part) => (
          <span key={part} className="movement-meta">
            {part}
          </span>
        ))}
        <span className="movement-meta">{t('fitness.records.sessions', { count: record.sessions })}</span>
      </span>
    </li>
  )
}
