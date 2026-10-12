import type { ParseKeys, TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon } from '../../ui/icons'
import {
  PRIORITIES,
  useCategories,
  useTask,
  useTasks,
  type Priority,
  type Task,
  type TaskKind,
  type TaskView,
} from './api'
import { CalendarView } from './CalendarView'
import { TaskEditor } from './TaskEditor'
import { TaskItem } from './TaskItem'
import { useTaskActions } from './useTaskActions'

type Tab = TaskView | 'CALENDAR'

const TABS: { value: Tab; label: ParseKeys }[] = [
  { value: 'TODAY', label: 'tasks.views.today' },
  { value: 'UPCOMING', label: 'tasks.views.upcoming' },
  { value: 'ALL', label: 'tasks.views.all' },
  { value: 'DONE', label: 'tasks.views.done' },
  { value: 'CALENDAR', label: 'tasks.views.calendar' },
]

const EMPTY: Record<TaskView, ParseKeys> = {
  TODAY: 'tasks.empty.today',
  UPCOMING: 'tasks.empty.upcoming',
  ALL: 'tasks.empty.all',
  DONE: 'tasks.empty.done',
}

interface Group {
  key: string
  title: string
  tasks: Task[]
}

/**
 * Pantalla de tareas. El estado vive en la URL (?vista, ?categoria, ?prioridad, ?tarea, ?nueva) para que
 * los enlaces desde el inicio o desde una notificación abran directamente lo que corresponde.
 */
export function TasksPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { today, relativeDate } = useDateFormat()
  const { completeTask, isCompleting } = useTaskActions()

  const tab = (TABS.find((item) => item.value === params.get('vista'))?.value ?? 'TODAY') as Tab
  const categoryId = params.get('categoria') ?? undefined
  const priority = (PRIORITIES.find((p) => p === params.get('prioridad')) ?? undefined) as Priority | undefined
  const editingId = params.get('tarea')
  const newKind = params.get('nueva') as TaskKind | null

  const view: TaskView = tab === 'CALENDAR' ? 'TODAY' : tab
  const tasks = useTasks(view, { categoryId, priority })
  const categories = useCategories()
  const editing = useTask(editingId)

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
    setParams(next, { replace: true })
  }

  const groups = groupTasks(tasks.data ?? [], tab, today, relativeDate, t)
  const filtered = Boolean(categoryId || priority)

  return (
    <div className="page stack-lg">
      <header className="page-header page-header-row">
        <h1 className="h1">{t('tasks.title')}</h1>
        <button type="button" className="button button-primary button-small" onClick={() => update({ nueva: 'TASK' })}>
          <PlusIcon />
          {t('tasks.new')}
        </button>
      </header>

      <nav className="tabs" aria-label={t('tasks.viewsLabel')}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            className="tab"
            aria-current={tab === item.value ? 'page' : undefined}
            onClick={() => update({ vista: item.value === 'TODAY' ? null : item.value })}
          >
            {t(item.label)}
          </button>
        ))}
      </nav>

      {tab === 'CALENDAR' ? (
        <CalendarView onOpenTask={(id) => update({ tarea: id })} />
      ) : (
        <>
          <div className="filters">
            <label className="filter">
              <span className="visually-hidden">{t('tasks.filters.category')}</span>
              <select value={categoryId ?? ''} onChange={(e) => update({ categoria: e.target.value || null })}>
                <option value="">
                  {t('tasks.filters.category')}: {t('tasks.filters.any')}
                </option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter">
              <span className="visually-hidden">{t('tasks.filters.priority')}</span>
              <select value={priority ?? ''} onChange={(e) => update({ prioridad: e.target.value || null })}>
                <option value="">
                  {t('tasks.filters.priority')}: {t('tasks.filters.any')}
                </option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`tasks.priority.${p}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {tasks.isPending && (
            <div className="screen-center-inline" role="status">
              <span className="spinner" aria-hidden="true" />
              <span className="visually-hidden">{t('common.loading')}</span>
            </div>
          )}
          {tasks.isError && (
            <div className="alert alert-error" role="alert">
              {tasks.error.message}
            </div>
          )}
          {tasks.isSuccess && groups.length === 0 && (
            <div className="card empty-state">
              <p className="muted">{t(filtered ? 'tasks.empty.filtered' : EMPTY[view])}</p>
            </div>
          )}
          {groups.map((group) => (
            <section key={group.key} className="stack-sm" aria-label={group.title}>
              {group.title && <h2 className="group-title">{group.title}</h2>}
              <ul className="task-list card">
                {group.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onOpen={(item) => update({ tarea: item.id })}
                    onComplete={completeTask}
                    completing={isCompleting(task.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {(newKind || (editingId && editing.data)) && (
        <TaskEditor
          key={editingId ?? newKind ?? ''}
          task={editingId ? (editing.data ?? null) : null}
          initialKind={newKind === 'REMINDER' ? 'REMINDER' : 'TASK'}
          onClose={() => update({ tarea: null, nueva: null })}
        />
      )}
    </div>
  )
}

function groupTasks(
  tasks: Task[],
  tab: Tab,
  today: string,
  relativeDate: (iso: string) => string,
  t: TFunction,
): Group[] {
  if (tasks.length === 0) return []
  if (tab === 'DONE') return [{ key: 'done', title: '', tasks }]
  if (tab === 'TODAY') {
    const overdue = tasks.filter((task) => task.overdue)
    const forToday = tasks.filter((task) => !task.overdue)
    return [
      { key: 'overdue', title: t('tasks.groups.overdue'), tasks: overdue },
      { key: 'today', title: overdue.length ? t('tasks.groups.today') : '', tasks: forToday },
    ].filter((group) => group.tasks.length > 0)
  }
  const groups = new Map<string, Group>()
  for (const task of tasks) {
    const key = task.dueDate == null ? 'none' : task.dueDate < today ? 'overdue' : task.dueDate
    const title =
      key === 'none' ? t('tasks.groups.noDate') : key === 'overdue' ? t('tasks.groups.overdue') : relativeDate(key)
    if (!groups.has(key)) groups.set(key, { key, title, tasks: [] })
    groups.get(key)!.tasks.push(task)
  }
  return [...groups.values()]
}
