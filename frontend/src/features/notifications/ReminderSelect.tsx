import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { Field } from '../../ui/Field'
import { usePushState } from './push'

/** Opciones de aviso en minutos antes de la hora. */
const NOTIFY_OPTIONS = [0, 5, 15, 30, 60, 120, 1440]

type Props = {
  id: string
  /** Sin hora no hay a qué referir el aviso: el campo se desactiva. */
  hasTime: boolean
  /** Minutos antes como texto; '' = sin aviso. */
  value: string
  onChange: (value: string) => void
  error?: string
}

/** Aviso «X minutos antes» compartido por tareas y actividades de la agenda. */
export function ReminderSelect({ id, hasTime, value, onChange, error }: Props) {
  const { t } = useTranslation()
  return (
    <>
      <Field label={t('tasks.form.notification')} id={id} error={error}>
        <select id={id} value={hasTime ? value : ''} disabled={!hasTime} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('tasks.notify.none')}</option>
          {NOTIFY_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {notifyLabel(minutes, t)}
            </option>
          ))}
        </select>
      </Field>
      {!hasTime && <p className="hint">{t('tasks.form.notificationNeedsTime')}</p>}
      {hasTime && value !== '' && <PushOffHint />}
    </>
  )
}

/** Recuerda que el aviso no llegará si las notificaciones están apagadas en este dispositivo. */
export function PushOffHint() {
  const { t } = useTranslation()
  const { status } = usePushState()
  if (status === 'on' || status === 'loading') return null
  return <p className="hint">{t('tasks.form.notificationsOff')}</p>
}

function notifyLabel(minutes: number, t: TFunction) {
  if (minutes === 0) return t('tasks.notify.atTime')
  if (minutes % 1440 === 0) return t('tasks.notify.days', { count: minutes / 1440 })
  if (minutes % 60 === 0) return t('tasks.notify.hours', { count: minutes / 60 })
  return t('tasks.notify.minutes', { count: minutes })
}
