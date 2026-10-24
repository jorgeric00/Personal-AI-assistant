import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { useCustomMetrics, useDeleteCustomMetric, useSaveCustomMetric, type CustomMetric } from './api'

/** Lista de indicadores propios con un formulario para crear o editar uno. */
export function CustomMetricsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const metrics = useCustomMetrics()
  const [editing, setEditing] = useState<CustomMetric | null>(null)
  const [formKey, setFormKey] = useState(0)

  const reset = () => {
    setEditing(null)
    setFormKey((k) => k + 1)
  }

  return (
    <Sheet title={t('fitness.custom.title')} onClose={onClose}>
      <div className="stack">
        <p className="hint">{t('fitness.custom.help')}</p>
        {metrics.data && metrics.data.length === 0 && <p className="muted">{t('fitness.custom.empty')}</p>}
        {metrics.data && metrics.data.length > 0 && (
          <ul className="card list-plain movement-list">
            {metrics.data.map((metric) => (
              <li key={metric.id}>
                <button
                  type="button"
                  className="movement-row"
                  aria-current={editing?.id === metric.id ? 'true' : undefined}
                  onClick={() => {
                    setEditing(metric)
                    setFormKey((k) => k + 1)
                  }}
                >
                  <span className="movement-main">
                    <span className="movement-title">{metric.name}</span>
                    <span className="movement-meta">
                      {[metric.unit, metric.archived ? t('fitness.custom.archivedTag') : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <MetricForm key={formKey} metric={editing} onDone={reset} />
      </div>
    </Sheet>
  )
}

function MetricForm({ metric, onDone }: { metric: CustomMetric | null; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const save = useSaveCustomMetric()
  const remove = useDeleteCustomMetric()
  const [name, setName] = useState(metric?.name ?? '')
  const [unit, setUnit] = useState(metric?.unit ?? '')
  const [decimals, setDecimals] = useState(metric?.decimals ?? 0)
  const [archived, setArchived] = useState(metric?.archived ?? false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    save.mutate(
      { id: metric?.id, input: { name: name.trim(), unit: unit.trim() || null, decimals, archived } },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          onDone()
        },
      },
    )
  }

  return (
    <form className="card stack" onSubmit={onSubmit} noValidate aria-labelledby="custom-metric-form-title">
      <h3 id="custom-metric-form-title" className="h3">
        {metric ? t('fitness.custom.edit') : t('fitness.custom.new')}
      </h3>
      {save.error instanceof ApiError && Object.keys(serverErrors).length === 0 && (
        <div className="alert alert-error" role="alert">
          {save.error.message}
        </div>
      )}
      <Field label={t('fitness.custom.name')} id="custom-name" error={serverErrors.name}>
        <input
          id="custom-name"
          maxLength={40}
          value={name}
          placeholder={t('fitness.custom.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="metric-grid">
        <Field label={t('fitness.custom.unit')} id="custom-unit" error={serverErrors.unit}>
          <input
            id="custom-unit"
            maxLength={12}
            value={unit}
            placeholder={t('fitness.custom.unitPlaceholder')}
            onChange={(e) => setUnit(e.target.value)}
          />
        </Field>
        <Field label={t('fitness.custom.decimals')} id="custom-decimals" error={serverErrors.decimals}>
          <select id="custom-decimals" value={decimals} onChange={(e) => setDecimals(Number(e.target.value))}>
            {[0, 1, 2].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {metric && (
        <label className="checkbox-row">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          <span>
            {t('fitness.custom.archived')}
            <span className="muted small"> · {t('fitness.custom.archivedHelp')}</span>
          </span>
        </label>
      )}
      <div className="button-row">
        {metric && (
          <button type="button" className="button button-ghost" onClick={onDone}>
            {t('common.cancel')}
          </button>
        )}
        <button type="submit" className="button button-primary" disabled={save.isPending || !name.trim()}>
          {metric ? t('common.save') : t('fitness.custom.add')}
        </button>
      </div>
      {metric && (
        <div className="stack-sm">
          {confirmingDelete ? (
            <>
              <p>{t('fitness.custom.deleteConfirm')}</p>
              <div className="button-row">
                <button type="button" className="button button-ghost" onClick={() => setConfirmingDelete(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="button button-danger-outline"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(metric.id, {
                      onSuccess: () => {
                        toast(t('common.deleted'))
                        onDone()
                      },
                      onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
                    })
                  }
                >
                  {t('fitness.custom.deleteForever')}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="button button-danger-outline" onClick={() => setConfirmingDelete(true)}>
              {t('common.delete')}
            </button>
          )}
        </div>
      )}
    </form>
  )
}
