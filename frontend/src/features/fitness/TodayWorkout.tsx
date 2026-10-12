import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { isoWeekday } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { WEEKDAYS } from '../tasks/api'
import { useRoutines, useWorkouts } from './api'

/**
 * Entreno en la pantalla Hoy: el entrenamiento en curso, el ya hecho hoy o las rutinas que tocan hoy. Si no hay
 * nada de eso, no se muestra.
 */
export function TodayWorkout() {
  const { t } = useTranslation()
  const { today } = useDateFormat()
  const routines = useRoutines()
  const workouts = useWorkouts()
  if (!routines.data || !workouts.data) return null

  const inProgress = workouts.data.find((w) => !w.finished)
  const doneToday = workouts.data.filter((w) => w.finished && w.date === today)
  const weekday = WEEKDAYS[isoWeekday(today) - 1]
  const scheduled = routines.data.filter((r) => r.weekdays.includes(weekday))
  if (!inProgress && doneToday.length === 0 && scheduled.length === 0) return null

  return (
    <section className="stack-sm" aria-labelledby="today-workout-title">
      <div className="section-header">
        <h2 id="today-workout-title" className="h2">
          {t('fitness.today.title')}
        </h2>
        <Link to="/entreno" className="link">
          {t('common.seeAll')}
        </Link>
      </div>
      <div className="card stack-sm">
        {inProgress ? (
          <div className="movement-row-static">
            <span className="movement-main">
              <span className="movement-title">{inProgress.name}</span>
              <span className="movement-meta">{t('fitness.workouts.doneSets', { count: inProgress.doneSets })}</span>
            </span>
            <Link to={`/entreno/sesion/${inProgress.id}`} className="button button-primary button-small">
              {t('fitness.workouts.continue')}
            </Link>
          </div>
        ) : doneToday.length > 0 ? (
          <p>{t('fitness.today.done', { names: doneToday.map((w) => w.name).join(', ') })}</p>
        ) : (
          <div className="movement-row-static">
            <span className="movement-main">
              <span className="movement-title">{scheduled.map((r) => r.name).join(', ')}</span>
              <span className="movement-meta">{t('fitness.today.scheduled')}</span>
            </span>
            <Link to="/entreno" className="button button-secondary button-small">
              {t('fitness.workouts.start')}
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
