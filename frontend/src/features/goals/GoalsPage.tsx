import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { ApiError } from '../../api/client'
import { PlusIcon } from '../../ui/icons'
import { useGoals, type Goal } from './api'
import { GoalCard } from './GoalCard'
import { GoalEditor } from './GoalEditor'
import { useGoalProgress } from './useGoalProgress'

const NEW = 'nuevo'

/**
 * Objetivos: los que están en marcha con su progreso real y, plegados, los conseguidos y abandonados. El formulario
 * abierto vive en ?objetivo.
 */
export function GoalsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const goals = useGoals()
  const all = goals.data ?? []
  const active = all.filter((g) => g.status === 'ACTIVE')
  const achieved = all.filter((g) => g.status === 'ACHIEVED')
  const dropped = all.filter((g) => g.status === 'DROPPED')
  const progressOf = useGoalProgress(active)

  const update = useCallback(
    (value: string | null) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value) next.set('objetivo', value)
          else next.delete('objetivo')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const editingParam = params.get('objetivo')
  const editing = editingParam && editingParam !== NEW ? all.find((g) => g.id === editingParam) : undefined

  const list = (items: Goal[]) => (
    <ul className="list-plain stack-sm">
      {items.map((goal) => (
        <GoalCard key={goal.id} goal={goal} progress={progressOf(goal)} onOpen={() => update(goal.id)} />
      ))}
    </ul>
  )

  return (
    <div className="page stack-lg">
      <header className="page-header page-header-row">
        <h1 className="h1">{t('goals.title')}</h1>
        <button type="button" className="button button-primary button-small" onClick={() => update(NEW)}>
          <PlusIcon />
          {t('goals.newShort')}
        </button>
      </header>

      {goals.isPending ? (
        <div className="card skeleton" aria-hidden="true" />
      ) : goals.isError ? (
        <div className="alert alert-error" role="alert">
          {goals.error instanceof ApiError ? goals.error.message : t('errors.generic')}
        </div>
      ) : all.length === 0 ? (
        <div className="card stack-sm">
          <p>{t('goals.empty')}</p>
          <p className="muted small">{t('goals.emptyExamples')}</p>
        </div>
      ) : (
        <>
          <section className="stack-sm" aria-labelledby="goals-active-title">
            <h2 id="goals-active-title" className="h2">
              {t('goals.active')}
            </h2>
            {active.length === 0 ? <p className="muted">{t('goals.noActive')}</p> : list(active)}
          </section>
          {achieved.length > 0 && (
            <details className="card goal-group">
              <summary>{t('goals.achieved', { count: achieved.length })}</summary>
              {list(achieved)}
            </details>
          )}
          {dropped.length > 0 && (
            <details className="card goal-group">
              <summary>{t('goals.droppedList', { count: dropped.length })}</summary>
              {list(dropped)}
            </details>
          )}
        </>
      )}

      {(editingParam === NEW || editing) && (
        <GoalEditor key={editingParam} goal={editing ?? null} onClose={() => update(null)} />
      )}
    </div>
  )
}
