import { useTranslation } from 'react-i18next'

import { useDateFormat } from '../../lib/useRelativeDate'
import { BellIcon, CheckIcon, RepeatIcon } from '../../ui/icons'
import type { Task } from './api'

interface TaskItemProps {
  task: Task
  onOpen: (task: Task) => void
  onComplete: (task: Task) => void
  completing?: boolean
}

export function TaskItem({ task, onOpen, onComplete, completing }: TaskItemProps) {
  const { t } = useTranslation()
  const { dateTime, relativeDate } = useDateFormat()
  const done = task.status === 'DONE'

  return (
    <li className={`task-item priority-${task.priority.toLowerCase()}${done ? ' is-done' : ''}`}>
      <button
        type="button"
        className="task-check"
        aria-label={t('tasks.complete', { title: task.title })}
        aria-pressed={done}
        disabled={done || completing}
        onClick={() => onComplete(task)}
      >
        {(done || completing) && <CheckIcon />}
      </button>
      <button type="button" className="task-body" onClick={() => onOpen(task)}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {(task.dueDate || !done) && (
            <span className={task.overdue ? 'is-overdue' : undefined}>
              {task.overdue && <span className="visually-hidden">{t('tasks.overdue')}: </span>}
              {dateTime(task.dueDate, task.dueTime)}
            </span>
          )}
          {task.kind === 'REMINDER' && <span className="badge">{t('tasks.kind.REMINDER')}</span>}
          {task.status === 'POSTPONED' && <span className="badge">{t('tasks.postponed')}</span>}
          {task.category && (
            <span className="category-tag">
              <span className="category-dot" style={{ background: task.category.color }} aria-hidden="true" />
              {task.category.name}
            </span>
          )}
          {task.recurrence && (
            <span className="meta-icon" title={t('tasks.recurring')}>
              <RepeatIcon />
              <span className="visually-hidden">{t('tasks.recurring')}</span>
            </span>
          )}
          {task.reminderMinutesBefore !== null && (
            <span className="meta-icon" title={t('tasks.hasNotification')}>
              <BellIcon />
              <span className="visually-hidden">{t('tasks.hasNotification')}</span>
            </span>
          )}
          {task.deadline && <span>{t('tasks.deadline', { date: relativeDate(task.deadline) })}</span>}
          {task.priority !== 'MEDIUM' && (
            <span className="visually-hidden">
              {t('tasks.priority.label')}: {t(`tasks.priority.${task.priority}`)}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}
