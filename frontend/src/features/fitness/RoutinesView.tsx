import { useTranslation } from 'react-i18next'

import { weekdayNames } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon } from '../../ui/icons'
import { WEEKDAYS } from '../tasks/api'
import { useRoutines, type Routine } from './api'
import { formatTarget } from './format'

/** Rutinas del usuario con sus días y ejercicios. */
export function RoutinesView({ onAdd, onOpen }: { onAdd: () => void; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const routines = useRoutines()

  if (routines.isPending) {
    return (
      <div className="screen-center-inline" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    )
  }
  if (routines.isError) {
    return (
      <div className="alert alert-error" role="alert">
        {routines.error.message}
      </div>
    )
  }
  if (routines.data.length === 0) {
    return (
      <div className="card empty-state stack">
        <p className="muted">{t('fitness.routines.empty')}</p>
        <button type="button" className="button button-primary" onClick={onAdd}>
          <PlusIcon />
          {t('fitness.routines.new')}
        </button>
      </div>
    )
  }
  return (
    <ul className="list-plain stack">
      {routines.data.map((routine) => (
        <li key={routine.id}>
          <RoutineCard routine={routine} onOpen={() => onOpen(routine.id)} />
        </li>
      ))}
    </ul>
  )
}

function RoutineCard({ routine, onOpen }: { routine: Routine; onOpen: () => void }) {
  const { t } = useTranslation()
  const { locale } = useDateFormat()
  const names = weekdayNames(locale)
  const days = WEEKDAYS.flatMap((day, i) => (routine.weekdays.includes(day) ? [names[i]] : []))
  return (
    <article className="card routine-card">
      <button type="button" className="routine-head" onClick={onOpen}>
        <span className="routine-name">{routine.name}</span>
        <span className="muted small">{days.length > 0 ? days.join(' · ') : t('fitness.routines.noDays')}</span>
      </button>
      <ol className="routine-items">
        {routine.exercises.map((item) => (
          <li key={item.id}>
            <span className="routine-item-name">{item.exercise.name}</span>
            <span className="muted small">{formatTarget(item.exercise.type, item, t, locale)}</span>
          </li>
        ))}
      </ol>
      {routine.notes && <p className="muted small entry-notes">{routine.notes}</p>}
    </article>
  )
}
