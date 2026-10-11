import type { ParseKeys } from 'i18next'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { PlusIcon } from '../../ui/icons'
import { useMeasurements } from './api'
import { MeasurementEditor } from './MeasurementEditor'
import { ProfileView } from './ProfileView'
import { ProgressView } from './ProgressView'

type Tab = 'PROGRESS' | 'PROFILE'

const TABS: { value: Tab; label: ParseKeys }[] = [
  { value: 'PROGRESS', label: 'fitness.views.progress' },
  { value: 'PROFILE', label: 'fitness.views.profile' },
]

/**
 * Entrenador personal. El estado vive en la URL (?vista, ?registro, ?nuevo) para que el acceso rápido de Hoy
 * abra directamente el formulario.
 */
export function FitnessPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const measurements = useMeasurements()

  const tab = TABS.find((item) => item.value === params.get('vista'))?.value ?? 'PROGRESS'
  const editingId = params.get('registro')
  const creating = params.get('nuevo') === '1'
  const editing = editingId ? measurements.data?.find((m) => m.id === editingId) : undefined

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return (
    <div className="page stack-lg">
      <header className="page-header page-header-row">
        <h1 className="h1">{t('fitness.title')}</h1>
        <button type="button" className="button button-primary button-small" onClick={() => update({ nuevo: '1', registro: null })}>
          <PlusIcon />
          {t('fitness.addEntry')}
        </button>
      </header>

      <nav className="tabs" aria-label={t('fitness.viewsLabel')}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            className="tab"
            aria-current={tab === item.value ? 'page' : undefined}
            onClick={() => update({ vista: item.value === 'PROGRESS' ? null : item.value })}
          >
            {t(item.label)}
          </button>
        ))}
      </nav>

      {tab === 'PROGRESS' && <ProgressView onAdd={() => update({ nuevo: '1' })} onOpen={(id) => update({ registro: id })} />}
      {tab === 'PROFILE' && <ProfileView />}

      {measurements.data && (creating || editing) && (
        <MeasurementEditor
          key={editingId ?? 'new'}
          measurement={editing ?? null}
          existing={measurements.data}
          onClose={() => update({ registro: null, nuevo: null })}
        />
      )}
    </div>
  )
}
