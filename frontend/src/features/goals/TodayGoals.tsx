import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { useGoals } from './api'
import { GoalCard } from './GoalCard'
import { useGoalProgress } from './useGoalProgress'

const TODAY_LIMIT = 3

/** En Hoy: los objetivos en marcha con su progreso. Si no hay, un enlace para crear uno. */
export function TodayGoals() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const goals = useGoals()
  const active = (goals.data ?? []).filter((g) => g.status === 'ACTIVE')
  const progressOf = useGoalProgress(active)
  if (!goals.data) return null

  return (
    <section aria-labelledby="today-goals-title" className="stack-sm">
      <div className="section-header">
        <h2 id="today-goals-title" className="h2">
          {t('goals.title')}
        </h2>
        <Link to="/objetivos" className="link">
          {t('common.seeAll')}
        </Link>
      </div>
      {active.length === 0 ? (
        <p className="card muted">
          {t('goals.todayEmpty')}{' '}
          <Link to="/objetivos?objetivo=nuevo" className="link">
            {t('goals.create')}
          </Link>
        </p>
      ) : (
        <ul className="list-plain stack-sm">
          {active.slice(0, TODAY_LIMIT).map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              progress={progressOf(goal)}
              compact
              onOpen={() => navigate(`/objetivos?objetivo=${goal.id}`)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
