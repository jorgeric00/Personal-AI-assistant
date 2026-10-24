import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError, apiFetch } from '../../api/client'
import { intlLocale } from '../../i18n'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'

const DATA_SCOPES = ['TASKS', 'NOTES', 'FINANCE', 'TRAINING', 'BODY', 'NUTRITION', 'AGENDA', 'HABITS', 'GOALS'] as const
type DataScope = (typeof DATA_SCOPES)[number]

function useDeleteData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { scopes: DataScope[]; password: string }) =>
      apiFetch<void>('/api/data/delete', { method: 'POST', body: input }),
    // Todo lo que se muestra puede haber cambiado
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * Borrado definitivo de bloques de datos. Hay que marcar qué se borra y escribir la contraseña; se recuerda antes
 * que se puede descargar una copia.
 */
export function DeleteDataSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const remove = useDeleteData()
  const [selected, setSelected] = useState<DataScope[]>([])
  const [password, setPassword] = useState('')

  const error = remove.error instanceof ApiError ? remove.error : null
  const passwordError = error?.fieldErrors.password

  // El error de la contraseña queda debajo de la lista: se lleva la vista hasta él para que se vea
  useEffect(() => {
    if (passwordError) document.getElementById('delete-password-error')?.scrollIntoView?.({ block: 'nearest' })
  }, [passwordError, remove.failureCount, remove.submittedAt])
  const all = selected.length === DATA_SCOPES.length
  const toggle = (scope: DataScope) =>
    setSelected((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : DATA_SCOPES.filter((s) => s === scope || current.includes(s)),
    )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    remove.mutate(
      { scopes: selected, password },
      {
        onSuccess: () => {
          toast(t('settings.deleteDone'))
          onClose()
        },
        onError: () => document.getElementById('delete-password')?.focus(),
      },
    )
  }

  return (
    <Sheet
      title={t('settings.deleteTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="delete-data-form"
            className="button button-danger"
            disabled={selected.length === 0 || !password || remove.isPending}
          >
            {remove.isPending ? t('settings.deleting') : t('settings.deleteConfirm')}
          </button>
        </>
      }
    >
      <form id="delete-data-form" className="stack" onSubmit={onSubmit} noValidate>
        <div className="alert alert-warning" role="note">
          {t('settings.deleteWarning')}{' '}
          <a className="link" href="/api/export" download>
            {t('settings.dataDownload')}
          </a>
        </div>
        {error && !passwordError && (
          <div className="alert alert-error" role="alert">
            {error.fieldErrors.scopes ?? error.message}
          </div>
        )}

        <fieldset className="stack-sm delete-scopes">
          <legend className="field-label">{t('settings.deleteWhat')}</legend>
          <label className="checkbox-row">
            <input type="checkbox" checked={all} onChange={() => setSelected(all ? [] : [...DATA_SCOPES])} />
            <span>
              <strong>{t('settings.deleteAll')}</strong>
            </span>
          </label>
          {DATA_SCOPES.map((scope) => (
            <label key={scope} className="checkbox-row">
              <input type="checkbox" checked={selected.includes(scope)} onChange={() => toggle(scope)} />
              <span>
                {t(`settings.scopes.${scope}.name`)}
                <span className="muted small checkbox-help">{t(`settings.scopes.${scope}.help`)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {selected.length > 0 && (
          <p role="status">
            {t('settings.deleteSummary', {
              list: new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(
                selected.map((scope) => t(`settings.scopes.${scope}.name`)),
              ),
            })}
          </p>
        )}

        <Field label={t('settings.deletePassword')} id="delete-password" error={passwordError}>
          <input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={Boolean(passwordError)}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </form>
    </Sheet>
  )
}
