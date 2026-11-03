import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { addDays, daysBetween, formatShortDate, formatTime } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { ReminderSelect } from '../notifications/ReminderSelect'
import { recurrenceFromFields, recurrenceToFields, type RecurrenceFieldValues } from '../tasks/recurrence'
import { RecurrenceFields } from '../tasks/RecurrenceFields'
import {
  STATUSES,
  useAgenda,
  useAgendaCategories,
  useDeleteActivity,
  useSaveActivity,
  useSetStatus,
  type Activity,
  type ActivityInput,
} from './api'
import { conflictsWith } from './schedule'

/** Rango máximo de la agenda que se puede pedir de una vez (lo limita la API). */
const MAX_RANGE_DAYS = 61

interface FormState extends RecurrenceFieldValues {
  title: string
  categoryId: string
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  location: string
  description: string
  notify: string
}

function pad(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

function initialState(activity: Activity | null, date: string, today: string): FormState {
  if (activity) {
    return {
      title: activity.title,
      categoryId: activity.category.id,
      allDay: !activity.startTime,
      startDate: activity.startDate,
      startTime: formatTime(activity.startTime),
      endDate: activity.endDate,
      endTime: formatTime(activity.endTime),
      location: activity.location ?? '',
      description: activity.description ?? '',
      notify: activity.reminderMinutesBefore != null ? String(activity.reminderMinutesBefore) : '',
      ...recurrenceToFields(activity.recurrence),
    }
  }
  // Hoy, la próxima hora en punto; otro día, a media mañana. Siempre una hora de duración.
  const start = date === today ? Math.min(22, new Date().getHours() + 1) : 10
  return {
    title: '',
    categoryId: '',
    allDay: false,
    startDate: date,
    startTime: pad(start),
    endDate: date,
    endTime: pad(start + 1),
    location: '',
    description: '',
    notify: '',
    ...recurrenceToFields(null),
  }
}

function toInput(form: FormState): ActivityInput {
  return {
    title: form.title.trim(),
    categoryId: form.categoryId,
    startDate: form.startDate,
    startTime: form.allDay ? null : form.startTime || null,
    endDate: form.endDate,
    endTime: form.allDay ? null : form.endTime || null,
    description: form.description.trim() || null,
    location: form.location.trim() || null,
    recurrence: recurrenceFromFields(form),
    reminderMinutesBefore: !form.allDay && form.startTime && form.notify !== '' ? Number(form.notify) : null,
  }
}

interface ActivityEditorProps {
  activity: Activity | null
  /** Aparición desde la que se abrió (para cambiar su estado), o la fecha propuesta al crear. */
  date: string
  onClose: () => void
}

export function ActivityEditor({ activity, date, onClose }: ActivityEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { today, locale, relativeDate } = useDateFormat()
  const [form, setForm] = useState(() => initialState(activity, date, today))
  const [showConflicts, setShowConflicts] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const conflictRef = useRef<HTMLDivElement>(null)
  const categories = useAgendaCategories()
  const save = useSaveActivity()
  const remove = useDeleteActivity()
  const setStatus = useSetStatus()

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Al mover el inicio, el fin se mueve con él para mantener la duración en días.
  const moveStart = (startDate: string) =>
    setForm((f) => {
      if (!startDate || !f.startDate || !f.endDate) return { ...f, startDate }
      return { ...f, startDate, endDate: addDays(startDate, Math.max(0, daysBetween(f.startDate, f.endDate))) }
    })

  const datesValid = Boolean(form.startDate && form.endDate && form.endDate >= form.startDate)
  const checkTo = !datesValid
    ? ''
    : daysBetween(form.startDate, form.endDate) > MAX_RANGE_DAYS
      ? addDays(form.startDate, MAX_RANGE_DAYS)
      : form.endDate
  const nearby = useAgenda(form.startDate, checkTo, datesValid && !form.allDay)
  const draft = toInput(form)
  const conflicts = datesValid && !form.allDay ? conflictsWith(draft, nearby.data ?? [], activity?.id) : []

  // Estado de la aparición desde la que se abrió
  const occurrence = useAgenda(date, date, Boolean(activity))
  const current = occurrence.data?.find(
    (item) => item.kind === 'ACTIVITY' && item.id === activity?.id && item.date === date,
  )

  // El aviso queda debajo de las horas: se lleva a la vista para que no pase desapercibido
  useEffect(() => {
    if (showConflicts) conflictRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [showConflicts])

  const error = save.error instanceof ApiError ? save.error : null
  const fieldErrors = error?.fieldErrors ?? {}
  const recurrenceError = Object.entries(fieldErrors).find(([key]) => key.startsWith('recurrence'))?.[1]

  const doSave = () =>
    save.mutate(
      { id: activity?.id, input: draft },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          onClose()
        },
      },
    )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    // Avisar de los solapamientos sin impedir guardar
    if (conflicts.length > 0 && !showConflicts) {
      setShowConflicts(true)
      return
    }
    doSave()
  }

  const onDelete = () => {
    if (!activity) return
    remove.mutate(activity.id, {
      onSuccess: () => {
        toast(t('common.deleted'))
        onClose()
      },
      onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
    })
  }

  const options = (categories.data ?? []).filter((c) => !c.archived || c.id === activity?.category.id)

  return (
    <Sheet
      title={activity ? t('agenda.edit') : t('agenda.new')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="activity-form" className="button button-primary" disabled={save.isPending}>
            {save.isPending
              ? t('common.saving')
              : showConflicts && conflicts.length > 0
                ? t('agenda.conflict.saveAnyway')
                : t('common.save')}
          </button>
        </>
      }
    >
      {activity && current && (
        <section className="stack-sm occurrence-status" aria-labelledby="occurrence-status">
          <h3 id="occurrence-status" className="h3">
            {t('agenda.status.label')} · {relativeDate(date)}
          </h3>
          <div className="chips" role="group" aria-labelledby="occurrence-status">
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className="chip"
                aria-pressed={current.status === status}
                disabled={setStatus.isPending}
                onClick={() =>
                  setStatus.mutate(
                    { id: activity.id, date, status },
                    {
                      onSuccess: () => toast(t('agenda.statusSaved', { status: t(`agenda.status.${status}`) })),
                      onError: (e) =>
                        toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
                    },
                  )
                }
              >
                {t(`agenda.status.${status}`)}
              </button>
            ))}
          </div>
        </section>
      )}

      <form id="activity-form" className="stack" onSubmit={onSubmit} noValidate>
        {error && Object.keys(fieldErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {error.message}
          </div>
        )}

        <Field label={t('agenda.form.title')} id="activity-title" error={fieldErrors.title}>
          <input
            id="activity-title"
            data-autofocus={activity ? undefined : true}
            value={form.title}
            placeholder={t('agenda.form.titlePlaceholder')}
            maxLength={200}
            onChange={(e) => set('title', e.target.value)}
            aria-invalid={Boolean(fieldErrors.title)}
          />
        </Field>

        <Field label={t('agenda.form.category')} id="activity-category" error={fieldErrors.categoryId}>
          <select
            id="activity-category"
            value={form.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
            aria-invalid={Boolean(fieldErrors.categoryId)}
          >
            <option value="" disabled>
              {t('agenda.form.chooseCategory')}
            </option>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <label className="checkbox-row">
          <input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />
          <span>{t('agenda.form.allDay')}</span>
        </label>

        <div className="field-row">
          <Field label={t('agenda.form.startDate')} id="activity-start-date" error={fieldErrors.startDate}>
            <input
              id="activity-start-date"
              type="date"
              value={form.startDate}
              onChange={(e) => moveStart(e.target.value)}
            />
          </Field>
          {!form.allDay && (
            <Field label={t('agenda.form.startTime')} id="activity-start-time" error={fieldErrors.startTime}>
              <input
                id="activity-start-time"
                type="time"
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
              />
            </Field>
          )}
        </div>
        <div className="field-row">
          <Field label={t('agenda.form.endDate')} id="activity-end-date" error={fieldErrors.endDate}>
            <input
              id="activity-end-date"
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(e) => set('endDate', e.target.value)}
              aria-invalid={Boolean(fieldErrors.endDate)}
            />
          </Field>
          {!form.allDay && (
            <Field label={t('agenda.form.endTime')} id="activity-end-time" error={fieldErrors.endTime}>
              <input
                id="activity-end-time"
                type="time"
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
              />
            </Field>
          )}
        </div>

        <ReminderSelect
          id="activity-notify"
          hasTime={!form.allDay && Boolean(form.startTime)}
          value={form.notify}
          onChange={(value) => set('notify', value)}
          error={fieldErrors.reminderMinutesBefore}
        />

        {showConflicts && conflicts.length > 0 && (
          <div ref={conflictRef} className="alert alert-warning stack-sm" role="alert">
            <strong>{t('agenda.conflict.title')}</strong>
            <span>{t('agenda.conflict.intro')}</span>
            <ul className="conflict-list">
              {conflicts.map((item) => (
                <li key={`${item.kind}-${item.id}-${item.date}`}>
                  {item.title} · {formatShortDate(item.startDate, locale)} {formatTime(item.startTime)}–
                  {formatTime(item.endTime)}
                </li>
              ))}
            </ul>
            {form.repeat !== 'none' && <span className="small">{t('agenda.conflict.onlyFirst')}</span>}
          </div>
        )}

        <RecurrenceFields
          idPrefix="activity"
          value={form}
          onChange={(changes) => setForm((f) => ({ ...f, ...changes }))}
          error={recurrenceError}
        />
        {activity?.recurrence && <p className="hint">{t('agenda.form.seriesHint')}</p>}

        <Field label={t('agenda.form.location')} id="activity-location" error={fieldErrors.location}>
          <input
            id="activity-location"
            value={form.location}
            maxLength={200}
            onChange={(e) => set('location', e.target.value)}
          />
        </Field>

        <Field label={t('agenda.form.description')} id="activity-description" error={fieldErrors.description}>
          <textarea
            id="activity-description"
            rows={3}
            value={form.description}
            maxLength={2000}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
      </form>

      {activity && (
        <section className="sheet-section">
          {confirmDelete ? (
            <div className="stack" role="alert">
              <p>{activity.recurrence ? t('agenda.deleteSeriesConfirm') : t('agenda.deleteConfirm')}</p>
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
