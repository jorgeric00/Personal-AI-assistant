import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { addDays, weekdayNames } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Sheet } from '../../ui/Sheet'
import { RelatedNotes } from '../notes/RelatedNotes'
import { useToast } from '../../ui/toast-context'
import { usePushState } from '../notifications/push'
import {
  CATEGORY_COLORS,
  PRIORITIES,
  WEEKDAYS,
  useCategories,
  useCreateCategory,
  useDeleteTask,
  usePostponeTask,
  useSaveTask,
  type Frequency,
  type Task,
  type TaskInput,
  type TaskKind,
  type Weekday,
} from './api'

type RepeatChoice = 'none' | Frequency | 'custom'

interface FormState {
  kind: TaskKind
  title: string
  description: string
  dueDate: string
  dueTime: string
  deadline: string
  priority: TaskInput['priority']
  categoryId: string
  repeat: RepeatChoice
  interval: string
  frequency: Frequency
  weekdays: Weekday[]
  until: string
  notify: string
}

/** Opciones de aviso en minutos antes de la hora. */
const NOTIFY_OPTIONS = [0, 5, 15, 30, 60, 120, 1440]

function initialState(task: Task | null, kind: TaskKind, today: string): FormState {
  const recurrence = task?.recurrence
  const isCustom =
    recurrence && (recurrence.interval !== 1 || (recurrence.weekdays?.length ?? 0) > 0 || recurrence.until)
  return {
    kind: task?.kind ?? kind,
    title: task?.title ?? '',
    description: task?.description ?? '',
    dueDate: task?.dueDate ?? (task ? '' : today),
    dueTime: task?.dueTime?.slice(0, 5) ?? '',
    deadline: task?.deadline ?? '',
    priority: task?.priority ?? 'MEDIUM',
    categoryId: task?.category?.id ?? '',
    repeat: !recurrence ? 'none' : isCustom ? 'custom' : recurrence.frequency,
    interval: String(recurrence?.interval ?? 1),
    frequency: recurrence?.frequency ?? 'WEEKLY',
    weekdays: recurrence?.weekdays ?? [],
    until: recurrence?.until ?? '',
    notify: task?.reminderMinutesBefore != null ? String(task.reminderMinutesBefore) : kind === 'REMINDER' ? '0' : '',
  }
}

function toInput(form: FormState): TaskInput {
  const recurrence =
    form.repeat === 'none'
      ? null
      : form.repeat === 'custom'
        ? {
            frequency: form.frequency,
            interval: Math.min(365, Math.max(1, Math.trunc(Number(form.interval)) || 1)),
            weekdays: form.frequency === 'WEEKLY' && form.weekdays.length > 0 ? form.weekdays : null,
            until: form.until || null,
          }
        : { frequency: form.repeat, interval: 1, weekdays: null, until: null }
  return {
    kind: form.kind,
    title: form.title.trim(),
    description: form.description.trim() || null,
    dueDate: form.dueDate || null,
    dueTime: form.dueTime || null,
    deadline: form.kind === 'TASK' ? form.deadline || null : null,
    priority: form.priority,
    categoryId: form.categoryId || null,
    recurrence,
    reminderMinutesBefore: form.dueTime && form.notify !== '' ? Number(form.notify) : null,
  }
}

interface TaskEditorProps {
  task: Task | null
  initialKind?: TaskKind
  onClose: () => void
}

export function TaskEditor({ task, initialKind = 'TASK', onClose }: TaskEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { today, locale, relativeDate } = useDateFormat()
  const [form, setForm] = useState(() => initialState(task, initialKind, today))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newCategory, setNewCategory] = useState<{ name: string; color: string } | null>(null)
  const [postponeDate, setPostponeDate] = useState('')
  const save = useSaveTask()
  const remove = useDeleteTask()
  const postpone = usePostponeTask()
  const categories = useCategories()
  const createCategory = useCreateCategory()
  const push = usePushState()

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const error = save.error instanceof ApiError ? save.error : null
  const fieldErrors = error?.fieldErrors ?? {}
  const fieldError = (...names: string[]) => names.map((name) => fieldErrors[name]).find(Boolean)
  const recurrenceError = Object.entries(fieldErrors).find(([key]) => key.startsWith('recurrence'))?.[1]

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate(
      { id: task?.id, input: toInput(form) },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          onClose()
        },
      },
    )
  }

  const onDelete = () => {
    if (!task) return
    remove.mutate(task.id, {
      onSuccess: () => {
        toast(t('common.deleted'))
        onClose()
      },
      onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
    })
  }

  const onPostpone = (date: string) => {
    if (!task || !date) return
    postpone.mutate(
      { id: task.id, date },
      {
        onSuccess: () => {
          toast(t('tasks.postpone.done', { date: relativeDate(date) }))
          onClose()
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
      },
    )
  }

  const onAddCategory = () => {
    if (!newCategory?.name.trim()) return
    createCategory.mutate(
      { name: newCategory.name.trim(), color: newCategory.color },
      {
        onSuccess: (category) => {
          set('categoryId', category.id)
          setNewCategory(null)
        },
      },
    )
  }

  const toggleWeekday = (day: Weekday) =>
    set('weekdays', form.weekdays.includes(day) ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day])

  const dayNames = weekdayNames(locale)
  const categoryError =
    createCategory.error instanceof ApiError
      ? (createCategory.error.fieldErrors.name ?? createCategory.error.message)
      : null
  const isOpen = task && task.status !== 'DONE'
  const title = task ? t('tasks.edit') : form.kind === 'REMINDER' ? t('tasks.newReminder') : t('tasks.newTask')

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="task-form" className="button button-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="task-form" className="stack" onSubmit={onSubmit} noValidate>
        {error && Object.keys(fieldErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {error.message}
          </div>
        )}

        <div className="segmented segmented-2" role="radiogroup" aria-label={t('tasks.kind.label')}>
          {(['TASK', 'REMINDER'] as TaskKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={form.kind === kind}
              className="segmented-option"
              onClick={() => set('kind', kind)}
            >
              {t(`tasks.kind.${kind}`)}
            </button>
          ))}
        </div>

        <Field label={t('tasks.form.title')} id="task-title" error={fieldError('title')}>
          <input
            id="task-title"
            data-autofocus
            value={form.title}
            placeholder={t('tasks.form.titlePlaceholder')}
            maxLength={200}
            onChange={(e) => set('title', e.target.value)}
            aria-invalid={Boolean(fieldError('title'))}
          />
        </Field>

        <div className="field-row">
          <Field label={t('tasks.form.date')} id="task-date" error={fieldError('dueDate')}>
            <input id="task-date" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </Field>
          <Field label={t('tasks.form.time')} id="task-time" error={fieldError('dueTime')}>
            <input
              id="task-time"
              type="time"
              value={form.dueTime}
              onChange={(e) => set('dueTime', e.target.value)}
              aria-invalid={Boolean(fieldError('dueTime'))}
            />
          </Field>
        </div>

        <Field label={t('tasks.form.notification')} id="task-notify" error={fieldError('reminderMinutesBefore')}>
          <select
            id="task-notify"
            value={form.dueTime ? form.notify : ''}
            disabled={!form.dueTime}
            onChange={(e) => set('notify', e.target.value)}
          >
            <option value="">{t('tasks.notify.none')}</option>
            {NOTIFY_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {notifyLabel(minutes, t)}
              </option>
            ))}
          </select>
        </Field>
        {!form.dueTime && <p className="hint">{t('tasks.form.notificationNeedsTime')}</p>}
        {form.dueTime && form.notify !== '' && push.status !== 'on' && push.status !== 'loading' && (
          <p className="hint">{t('tasks.form.notificationsOff')}</p>
        )}

        <Field label={t('tasks.form.repeat')} id="task-repeat" error={recurrenceError}>
          <select
            id="task-repeat"
            value={form.repeat}
            onChange={(e) => set('repeat', e.target.value as RepeatChoice)}
          >
            <option value="none">{t('tasks.repeat.none')}</option>
            <option value="DAILY">{t('tasks.repeat.DAILY')}</option>
            <option value="WEEKLY">{t('tasks.repeat.WEEKLY')}</option>
            <option value="MONTHLY">{t('tasks.repeat.MONTHLY')}</option>
            <option value="custom">{t('tasks.repeat.custom')}</option>
          </select>
        </Field>

        {form.repeat === 'custom' && (
          <fieldset className="subform stack">
            <legend className="visually-hidden">{t('tasks.repeat.custom')}</legend>
            <div className="field-row">
              <Field label={t('tasks.repeat.every')} id="task-interval">
                <input
                  id="task-interval"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  value={form.interval}
                  onChange={(e) => set('interval', e.target.value)}
                />
              </Field>
              <Field label={' '} id="task-frequency">
                <select
                  id="task-frequency"
                  aria-label={t('tasks.form.repeat')}
                  value={form.frequency}
                  onChange={(e) => set('frequency', e.target.value as Frequency)}
                >
                  {(['DAILY', 'WEEKLY', 'MONTHLY'] as Frequency[]).map((f) => (
                    <option key={f} value={f}>
                      {t(`tasks.repeat.unit.${f}`, { count: Number(form.interval) || 1 })}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {form.frequency === 'WEEKLY' && (
              <div className="field">
                <span className="field-label" id="weekdays-label">
                  {t('tasks.repeat.weekdays')}
                </span>
                <div className="chips" role="group" aria-labelledby="weekdays-label">
                  {WEEKDAYS.map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      className="chip"
                      aria-pressed={form.weekdays.includes(day)}
                      onClick={() => toggleWeekday(day)}
                    >
                      {dayNames[index]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Field label={t('tasks.repeat.until')} id="task-until">
              <input id="task-until" type="date" value={form.until} onChange={(e) => set('until', e.target.value)} />
            </Field>
          </fieldset>
        )}

        <div className="field">
          <span className="field-label" id="priority-label">
            {t('tasks.priority.label')}
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="priority-label">
            {PRIORITIES.map((priority) => (
              <button
                key={priority}
                type="button"
                role="radio"
                aria-checked={form.priority === priority}
                className="segmented-option"
                onClick={() => set('priority', priority)}
              >
                {t(`tasks.priority.${priority}`)}
              </button>
            ))}
          </div>
        </div>

        <Field label={t('tasks.form.category')} id="task-category" error={fieldError('categoryId')}>
          <select
            id="task-category"
            value={newCategory ? '__new' : form.categoryId}
            onChange={(e) => {
              if (e.target.value === '__new') {
                setNewCategory({ name: '', color: CATEGORY_COLORS[0] })
              } else {
                setNewCategory(null)
                set('categoryId', e.target.value)
              }
            }}
          >
            <option value="">{t('tasks.form.noCategory')}</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value="__new">{t('tasks.form.newCategory')}…</option>
          </select>
        </Field>

        {newCategory && (
          <div className="subform stack">
            <Field label={t('tasks.form.categoryName')} id="new-category" error={categoryError ?? undefined}>
              <input
                id="new-category"
                value={newCategory.name}
                maxLength={50}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              />
            </Field>
            <div className="color-picker" role="radiogroup" aria-label={t('tasks.form.categoryColor')}>
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={newCategory.color === color}
                  aria-label={color}
                  className="color-swatch"
                  style={{ background: color }}
                  onClick={() => setNewCategory({ ...newCategory, color })}
                />
              ))}
            </div>
            <button
              type="button"
              className="button button-secondary"
              disabled={!newCategory.name.trim() || createCategory.isPending}
              onClick={onAddCategory}
            >
              {t('tasks.form.addCategory')}
            </button>
          </div>
        )}

        {form.kind === 'TASK' && (
          <Field label={t('tasks.form.deadline')} id="task-deadline" error={fieldError('deadline')}>
            <input
              id="task-deadline"
              type="date"
              value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)}
            />
          </Field>
        )}

        <Field label={t('tasks.form.description')} id="task-description" error={fieldError('description')}>
          <textarea
            id="task-description"
            rows={3}
            value={form.description}
            maxLength={5000}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
      </form>

      {isOpen && (
        <section className="sheet-section stack" aria-labelledby="postpone-title">
          <h3 id="postpone-title" className="h3">
            {t('tasks.postpone.title')}
          </h3>
          <div className="chips">
            <button type="button" className="chip" onClick={() => onPostpone(addDays(today, 1))}>
              {t('tasks.postpone.tomorrow')}
            </button>
            <button type="button" className="chip" onClick={() => onPostpone(addDays(today, 7))}>
              {t('tasks.postpone.nextWeek')}
            </button>
          </div>
          <div className="inline-form">
            <label htmlFor="postpone-date" className="visually-hidden">
              {t('tasks.postpone.pickDate')}
            </label>
            <input
              id="postpone-date"
              type="date"
              min={today}
              value={postponeDate}
              onChange={(e) => setPostponeDate(e.target.value)}
            />
            <button
              type="button"
              className="button button-secondary"
              disabled={!postponeDate || postpone.isPending}
              onClick={() => onPostpone(postponeDate)}
            >
              {t('tasks.postpone.apply')}
            </button>
          </div>
        </section>
      )}

      {task && <RelatedNotes taskId={task.id} />}

      {task && (
        <section className="sheet-section">
          {confirmDelete ? (
            <div className="stack" role="alert">
              <p>{t('tasks.deleteConfirm')}</p>
              <div className="inline-form">
                <button type="button" className="button button-ghost" onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="button button-danger" disabled={remove.isPending} onClick={onDelete}>
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

function notifyLabel(minutes: number, t: ReturnType<typeof useTranslation>['t']) {
  if (minutes === 0) return t('tasks.notify.atTime')
  if (minutes % 1440 === 0) return t('tasks.notify.days', { count: minutes / 1440 })
  if (minutes % 60 === 0) return t('tasks.notify.hours', { count: minutes / 60 })
  return t('tasks.notify.minutes', { count: minutes })
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string
  id: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
