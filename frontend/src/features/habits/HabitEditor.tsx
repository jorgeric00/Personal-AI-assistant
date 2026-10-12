import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { weekdayNames } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { CATEGORY_COLORS, WEEKDAYS, type Weekday } from '../tasks/api'
import { useDeleteHabit, useSaveHabit, type Habit, type HabitFrequency } from './api'

interface HabitEditorProps {
  habit: Habit | null
  onClose: () => void
}

/** Alta y edición de un hábito: nombre, color y frecuencia esperada. */
export function HabitEditor({ habit, onClose }: HabitEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale } = useDateFormat()
  const dayNames = weekdayNames(locale)
  const [name, setName] = useState(habit?.name ?? '')
  const [color, setColor] = useState(habit?.color ?? CATEGORY_COLORS[0])
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency ?? 'DAILY')
  const [weekdays, setWeekdays] = useState<Weekday[]>(habit?.weekdays ?? [])
  const [timesPerWeek, setTimesPerWeek] = useState(habit?.timesPerWeek ?? 3)
  const [archived, setArchived] = useState(habit?.archived ?? false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const save = useSaveHabit()
  const remove = useDeleteHabit()
  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    save.mutate(
      {
        id: habit?.id,
        name: name.trim(),
        color,
        frequency,
        weekdays: frequency === 'DAILY' ? WEEKDAYS.filter((d) => weekdays.includes(d)) : [],
        timesPerWeek: frequency === 'WEEKLY' ? timesPerWeek : null,
        archived,
      },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          onClose()
        },
      },
    )
  }

  return (
    <Sheet
      title={habit ? t('habits.edit') : t('habits.new')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="habit-form" className="button button-primary" disabled={save.isPending || !name.trim()}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="habit-form" className="stack" onSubmit={onSubmit} noValidate>
        {save.error instanceof ApiError && Object.keys(serverErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {save.error.message}
          </div>
        )}
        <Field label={t('habits.form.name')} id="habit-name" error={serverErrors.name}>
          <input
            id="habit-name"
            data-autofocus
            maxLength={80}
            value={name}
            placeholder={t('habits.form.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="field">
          <span className="field-label" id="habit-color-label">
            {t('habits.form.color')}
          </span>
          <div className="color-picker" role="radiogroup" aria-labelledby="habit-color-label">
            {CATEGORY_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={color === option}
                aria-label={option}
                className="color-swatch"
                style={{ background: option }}
                onClick={() => setColor(option)}
              />
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label" id="habit-frequency-label">
            {t('habits.form.frequency')}
          </span>
          <div className="segmented segmented-2" role="radiogroup" aria-labelledby="habit-frequency-label">
            {(['DAILY', 'WEEKLY'] as HabitFrequency[]).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={frequency === option}
                className="segmented-option"
                onClick={() => setFrequency(option)}
              >
                {t(`habits.frequency.${option}`)}
              </button>
            ))}
          </div>
        </div>
        {frequency === 'DAILY' ? (
          <div className="field">
            <span className="field-label" id="habit-days-label">
              {t('habits.form.days')}
            </span>
            <div className="chips" role="group" aria-labelledby="habit-days-label">
              {WEEKDAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  className="chip"
                  aria-pressed={weekdays.includes(day)}
                  onClick={() =>
                    setWeekdays(weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day])
                  }
                >
                  {dayNames[index]}
                </button>
              ))}
            </div>
            <p className="muted small">{t('habits.form.daysHelp')}</p>
          </div>
        ) : (
          <Field label={t('habits.form.timesPerWeek')} id="habit-times" error={serverErrors.timesPerWeek}>
            <select id="habit-times" value={timesPerWeek} onChange={(e) => setTimesPerWeek(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {t('habits.timesPerWeek', { count: n })}
                </option>
              ))}
            </select>
          </Field>
        )}
        {habit && (
          <label className="checkbox-row">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
            <span>
              {t('habits.form.archived')}
              <span className="muted small"> · {t('habits.form.archivedHelp')}</span>
            </span>
          </label>
        )}
      </form>

      {habit && (
        <section className="sheet-section stack-sm">
          {confirmingDelete ? (
            <>
              <p>{t('habits.deleteConfirm')}</p>
              <div className="button-row">
                <button type="button" className="button button-ghost" onClick={() => setConfirmingDelete(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="button button-danger-outline"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(habit.id, {
                      onSuccess: () => {
                        toast(t('common.deleted'))
                        onClose()
                      },
                      onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
                    })
                  }
                >
                  {t('habits.deleteForever')}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="button button-danger-outline" onClick={() => setConfirmingDelete(true)}>
              {t('common.delete')}
            </button>
          )}
        </section>
      )}
    </Sheet>
  )
}
