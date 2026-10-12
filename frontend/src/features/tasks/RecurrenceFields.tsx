import { useTranslation } from 'react-i18next'

import { weekdayNames } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { WEEKDAYS, type Frequency, type Weekday } from './api'
import type { RecurrenceFieldValues, RepeatChoice } from './recurrence'

interface RecurrenceFieldsProps {
  idPrefix: string
  value: RecurrenceFieldValues
  onChange: (changes: Partial<RecurrenceFieldValues>) => void
  error?: string
}

export function RecurrenceFields({ idPrefix, value, onChange, error }: RecurrenceFieldsProps) {
  const { t } = useTranslation()
  const { locale } = useDateFormat()
  const dayNames = weekdayNames(locale)
  const toggleWeekday = (day: Weekday) =>
    onChange({
      weekdays: value.weekdays.includes(day) ? value.weekdays.filter((d) => d !== day) : [...value.weekdays, day],
    })

  return (
    <>
      <Field label={t('tasks.form.repeat')} id={`${idPrefix}-repeat`} error={error}>
        <select
          id={`${idPrefix}-repeat`}
          value={value.repeat}
          onChange={(e) => onChange({ repeat: e.target.value as RepeatChoice })}
        >
          <option value="none">{t('tasks.repeat.none')}</option>
          <option value="DAILY">{t('tasks.repeat.DAILY')}</option>
          <option value="WEEKLY">{t('tasks.repeat.WEEKLY')}</option>
          <option value="MONTHLY">{t('tasks.repeat.MONTHLY')}</option>
          <option value="custom">{t('tasks.repeat.custom')}</option>
        </select>
      </Field>

      {value.repeat === 'custom' && (
        <fieldset className="subform stack">
          <legend className="visually-hidden">{t('tasks.repeat.custom')}</legend>
          <div className="field-row">
            <Field label={t('tasks.repeat.every')} id={`${idPrefix}-interval`}>
              <input
                id={`${idPrefix}-interval`}
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={value.interval}
                onChange={(e) => onChange({ interval: e.target.value })}
              />
            </Field>
            <Field label={' '} id={`${idPrefix}-frequency`}>
              <select
                id={`${idPrefix}-frequency`}
                aria-label={t('tasks.form.repeat')}
                value={value.frequency}
                onChange={(e) => onChange({ frequency: e.target.value as Frequency })}
              >
                {(['DAILY', 'WEEKLY', 'MONTHLY'] as Frequency[]).map((f) => (
                  <option key={f} value={f}>
                    {t(`tasks.repeat.unit.${f}`, { count: Number(value.interval) || 1 })}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {value.frequency === 'WEEKLY' && (
            <div className="field">
              <span className="field-label" id={`${idPrefix}-weekdays-label`}>
                {t('tasks.repeat.weekdays')}
              </span>
              <div className="chips" role="group" aria-labelledby={`${idPrefix}-weekdays-label`}>
                {WEEKDAYS.map((day, index) => (
                  <button
                    key={day}
                    type="button"
                    className="chip"
                    aria-pressed={value.weekdays.includes(day)}
                    onClick={() => toggleWeekday(day)}
                  >
                    {dayNames[index]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Field label={t('tasks.repeat.until')} id={`${idPrefix}-until`}>
            <input
              id={`${idPrefix}-until`}
              type="date"
              value={value.until}
              onChange={(e) => onChange({ until: e.target.value })}
            />
          </Field>
        </fieldset>
      )}
    </>
  )
}
