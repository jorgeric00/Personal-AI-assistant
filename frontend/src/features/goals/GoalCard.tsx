import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { daysBetween, formatDateWithYear } from '../../lib/date'
import { formatDecimal } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { useToast } from '../../ui/toast-context'
import { METRIC_DECIMALS, METRIC_UNITS } from '../fitness/api'
import { BODY_METRICS, useSaveGoal, type Goal } from './api'
import type { GoalProgress } from './progress'

interface GoalCardProps {
  goal: Goal
  progress: GoalProgress | null
  onOpen: () => void
  compact?: boolean
}

/** Un objetivo con su progreso real. «Meta alcanzada» lo dicen los registros; darlo por conseguido lo decide el usuario. */
export function GoalCard({ goal, progress, onOpen, compact = false }: GoalCardProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale, today } = useDateFormat()
  const save = useSaveGoal()
  const detail = useProgressText(goal, progress)
  const active = goal.status === 'ACTIVE'

  const markAchieved = () =>
    save.mutate(
      { ...goal, status: 'ACHIEVED' },
      {
        onSuccess: () => toast(t('goals.achievedToast')),
        onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
      },
    )

  const remaining = goal.targetDate ? daysBetween(today, goal.targetDate) : null

  return (
    <li className="card stack-sm goal-card">
      <button type="button" className="goal-title" onClick={onOpen}>
        <span className="food-name">{goal.title}</span>
        <span className="food-meta">{t(`goals.kind.${goal.kind}`)}</span>
      </button>
      {active && progress?.percent != null && (
        <span
          className="category-bar-track goal-bar"
          role="progressbar"
          aria-label={t('goals.progressLabel', { title: goal.title })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <span className="category-bar-fill" style={{ width: `${progress.percent}%`, background: 'var(--accent)' }} />
        </span>
      )}
      {active && detail && <p className={progress?.missing ? 'small warning-text' : 'small'}>{detail}</p>}
      {active && progress?.reached && <p className="small goal-reached">{t('goals.reached')}</p>}
      {!compact && (
        <p className="muted small">
          {goal.status === 'ACHIEVED' && goal.achievedOn
            ? t('goals.achievedOn', { date: formatDateWithYear(goal.achievedOn, locale) })
            : goal.status === 'DROPPED'
              ? t('goals.dropped')
              : remaining == null
                ? t('goals.noDate')
                : remaining >= 0
                  ? t('goals.dueIn', { date: formatDateWithYear(goal.targetDate!, locale), count: remaining })
                  : t('goals.duePassed', { date: formatDateWithYear(goal.targetDate!, locale) })}
        </p>
      )}
      {!compact && active && (goal.kind === 'CUSTOM' || progress?.reached) && (
        <button type="button" className="button button-secondary button-small goal-done" disabled={save.isPending} onClick={markAchieved}>
          {t('goals.markAchieved')}
        </button>
      )}
    </li>
  )
}

/** Frase con lo que dicen los registros, solo con datos reales. */
function useProgressText(goal: Goal, progress: GoalProgress | null): string | null {
  const { t } = useTranslation()
  const { locale } = useDateFormat()
  if (goal.kind === 'CUSTOM') return t('goals.progress.custom')
  if (!progress) return null
  if (progress.missing) return t(goal.kind === 'EXERCISE' ? 'goals.progress.exerciseMissing' : 'goals.progress.habitMissing')
  const target = goal.targetValue ?? 0
  switch (goal.kind) {
    case 'BODY': {
      const metric = BODY_METRICS[goal.metric!]
      const name = t(`fitness.metrics.${metric}`)
      if (progress.current == null) return t('goals.progress.bodyEmpty', { metric: name.toLocaleLowerCase() })
      const format = (v: number) => `${formatDecimal(v, locale, METRIC_DECIMALS[metric])} ${METRIC_UNITS[metric]}`
      return t('goals.progress.body', {
        metric: name,
        current: format(progress.current),
        start: format(progress.start!),
        target: format(target),
      })
    }
    case 'TRAINING':
      return [
        t('goals.progress.training', { count: target, current: progress.current }),
        progress.weeksMet && progress.weeksMet.of > 0
          ? t('goals.progress.trainingWeeks', { met: progress.weeksMet.met, count: progress.weeksMet.of })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    case 'EXERCISE':
      return progress.current == null
        ? t('goals.progress.exerciseEmpty')
        : t('goals.progress.exercise', {
            current: formatDecimal(progress.current, locale, 2),
            target: formatDecimal(target, locale, 2),
          })
    case 'HABIT':
      return progress.current == null
        ? t('goals.progress.habitEmpty')
        : t('goals.progress.habit', { current: progress.current, target })
    case 'MEAL_PLAN':
      return progress.current == null
        ? t('goals.progress.mealPlanEmpty')
        : t('goals.progress.mealPlan', { current: progress.current, target })
    default:
      return null
  }
}
