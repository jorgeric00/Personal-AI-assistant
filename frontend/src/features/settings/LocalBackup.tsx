import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCurrentUser } from '../../auth/auth'
import { todayIso } from '../../lib/date'
import { useToast } from '../../ui/toast-context'

// La comparación literal permite que la versión web no incluya el código de la app.
const loadLocal = () =>
  import.meta.env.VITE_LOCAL === 'true' ? import('../../local') : Promise.reject(new Error('web'))

/** Copia de seguridad de la app: un archivo con todos los datos, que la persona guarda donde quiera. */
export function LocalBackup() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: user } = useCurrentUser()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const save = useMutation({
    mutationFn: async () => (await loadLocal()).exportBackup(todayIso(user?.timezone)),
    onError: () => toast(t('settings.backupError'), { tone: 'error' }),
  })
  const restore = useMutation({
    mutationFn: async (backup: File) => (await loadLocal()).restoreBackup(backup),
    onSuccess: () => {
      toast(t('settings.backupRestored'))
      // Se recarga la app entera para que todas las pantallas muestren los datos restaurados.
      setTimeout(() => window.location.assign('/'), 600)
    },
  })

  return (
    <section className="card stack" aria-labelledby="backup-title">
      <h2 id="backup-title" className="h2">
        {t('settings.backup')}
      </h2>
      <p className="muted">{t('settings.backupIntro')}</p>
      <div className="inline-form">
        <button
          type="button"
          className="button button-primary"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {t('settings.backupSave')}
        </button>
        <button type="button" className="button button-secondary" onClick={() => input.current?.click()}>
          {t('settings.backupRestore')}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        aria-label={t('settings.backupRestore')}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null)
          restore.reset()
          e.target.value = ''
        }}
      />
      {file && (
        <div className="stack-sm" role="group" aria-label={t('settings.backupRestore')}>
          <p>{t('settings.backupConfirm', { name: file.name })}</p>
          {restore.isError && (
            <p className="field-error" role="alert">
              {restore.error.message}
            </p>
          )}
          <div className="inline-form">
            <button
              type="button"
              className="button button-danger-outline"
              disabled={restore.isPending || restore.isSuccess}
              onClick={() => restore.mutate(file)}
            >
              {t('settings.backupConfirmAction')}
            </button>
            <button type="button" className="button button-ghost" onClick={() => setFile(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
