import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { decimalToInput, parseDecimal, parseSignedDecimal } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import {
  METRIC_DECIMALS,
  METRIC_UNITS,
  METRICS,
  useCustomMetrics,
  useDeleteMeasurement,
  useSaveMeasurement,
  type Measurement,
  type Metric,
} from './api'

type Values = Record<Metric, string>

function toValues(measurement: Measurement | null, locale: string): Values {
  return Object.fromEntries(METRICS.map((metric) => [metric, decimalToInput(measurement?.[metric], locale)])) as Values
}

function toCustomValues(measurement: Measurement | null, locale: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(measurement?.custom ?? {}).map(([id, value]) => [id, decimalToInput(value, locale)]),
  )
}

interface MeasurementEditorProps {
  /** Registro a editar; null para uno nuevo. */
  measurement: Measurement | null
  /** Todos los registros, para abrir el del mismo día en lugar de duplicarlo. */
  existing: Measurement[]
  onClose: () => void
}

/** Formulario de un registro de evolución. Solo hace falta rellenar lo que se haya medido. */
export function MeasurementEditor({ measurement: initial, existing, onClose }: MeasurementEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { today, locale } = useDateFormat()
  const save = useSaveMeasurement()
  const remove = useDeleteMeasurement()
  const customMetrics = useCustomMetrics()

  const [editing, setEditing] = useState<Measurement | null>(initial)
  const [date, setDate] = useState(initial?.date ?? today)
  const [values, setValues] = useState<Values>(() => toValues(initial, locale))
  const [customValues, setCustomValues] = useState(() => toCustomValues(initial, locale))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const error = save.error instanceof ApiError ? save.error : null
  const fieldErrors: Record<string, string | undefined> = { ...(error?.fieldErrors ?? {}), ...localErrors }

  // Al elegir un día que ya tiene registro en un formulario nuevo, se pasa a editar ese registro.
  const changeDate = (next: string) => {
    setDate(next)
    const sameDay = existing.find((m) => m.date === next && m.id !== editing?.id)
    if (sameDay && !initial) {
      setEditing(sameDay)
      setValues(toValues(sameDay, locale))
      setCustomValues(toCustomValues(sameDay, locale))
      setNotes(sameDay.notes ?? '')
    } else if (!sameDay && !initial && editing) {
      setEditing(null)
    }
  }

  // Los indicadores activos y los archivados que ya tienen valor en este registro
  const shownCustom = (customMetrics.data ?? []).filter((m) => !m.archived || customValues[m.id])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    const parsed = {} as Record<Metric, number | null>
    for (const metric of METRICS) {
      const value = parseDecimal(values[metric], METRIC_DECIMALS[metric])
      if (value === null) errors[metric] = t('fitness.form.invalidNumber', { count: METRIC_DECIMALS[metric] })
      parsed[metric] = value ?? null
    }
    const custom: Record<string, number> = {}
    for (const metric of shownCustom) {
      const value = parseSignedDecimal(customValues[metric.id] ?? '', metric.decimals)
      if (value === null) errors[`custom.${metric.id}`] = t('fitness.form.invalidNumber', { count: metric.decimals })
      else if (value !== undefined) custom[metric.id] = value
    }
    const empty = METRICS.every((m) => parsed[m] === null) && Object.keys(custom).length === 0 && !notes.trim()
    if (Object.keys(errors).length === 0 && empty) {
      errors.form = t('fitness.form.empty')
    }
    setLocalErrors(errors)
    if (Object.keys(errors).length > 0) return
    save.mutate(
      { id: editing?.id, input: { date, ...parsed, notes: notes.trim() || null, custom } },
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
      title={editing ? t('fitness.editEntry') : t('fitness.newEntry')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="measurement-form" className="button button-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="measurement-form" className="stack" onSubmit={onSubmit} noValidate>
        {(localErrors.form || (error && Object.keys(error.fieldErrors).length === 0)) && (
          <div className="alert alert-error" role="alert">
            {localErrors.form ?? error?.message}
          </div>
        )}
        <Field label={t('fitness.form.date')} id="measurement-date" error={fieldErrors.date}>
          <input id="measurement-date" type="date" value={date} max={today} onChange={(e) => changeDate(e.target.value)} />
        </Field>
        {editing && !initial && (
          <p className="alert alert-info" role="status">
            {t('fitness.form.sameDay')}
          </p>
        )}
        <p className="muted small">{t('fitness.form.help')}</p>

        <div className="metric-grid">
          {METRICS.map((metric) => (
            <Field key={metric} label={`${t(`fitness.metrics.${metric}`)} (${METRIC_UNITS[metric]})`} id={`m-${metric}`} error={fieldErrors[metric]}>
              <input
                id={`m-${metric}`}
                inputMode="decimal"
                autoComplete="off"
                data-autofocus={metric === 'weightKg' ? true : undefined}
                value={values[metric]}
                aria-invalid={Boolean(fieldErrors[metric])}
                onChange={(e) => setValues({ ...values, [metric]: e.target.value })}
              />
            </Field>
          ))}
          {shownCustom.map((metric) => (
            <Field
              key={metric.id}
              label={metric.unit ? `${metric.name} (${metric.unit})` : metric.name}
              id={`c-${metric.id}`}
              error={fieldErrors[`custom.${metric.id}`]}
            >
              <input
                id={`c-${metric.id}`}
                inputMode="decimal"
                autoComplete="off"
                value={customValues[metric.id] ?? ''}
                aria-invalid={Boolean(fieldErrors[`custom.${metric.id}`])}
                onChange={(e) => setCustomValues({ ...customValues, [metric.id]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        {customMetrics.data?.length === 0 && <p className="hint">{t('fitness.custom.editorHint')}</p>}

        <Field label={t('fitness.form.notes')} id="measurement-notes" error={fieldErrors.notes}>
          <textarea
            id="measurement-notes"
            rows={3}
            maxLength={1000}
            value={notes}
            placeholder={t('fitness.form.notesPlaceholder')}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </form>

      {editing && (
        <section className="sheet-section">
          {confirmDelete ? (
            <div className="stack" role="alert">
              <p>{t('fitness.deleteConfirm')}</p>
              <div className="inline-form">
                <button type="button" className="button button-ghost" onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(editing.id, {
                      onSuccess: () => {
                        toast(t('common.deleted'))
                        onClose()
                      },
                    })
                  }
                >
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
