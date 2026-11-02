import { useTranslation } from 'react-i18next'

import { useOpenExactAlarmSetting, useReminderStatus, useRequestReminderPermission } from './localReminders'

/** Ajustes de avisos en la app Android: los programa el propio móvil, sin servidor. */
export function LocalReminderSettings() {
  const { t } = useTranslation()
  const { data: status, isPending } = useReminderStatus()
  const request = useRequestReminderPermission()
  const exact = useOpenExactAlarmSetting()

  const message = isPending
    ? t('common.loading')
    : !status || status.permission === 'unsupported'
      ? t('settings.remindersAppOnly')
      : status.permission === 'denied'
        ? t('settings.remindersDenied')
        : status.permission === 'prompt'
          ? t('settings.remindersOff')
          : t('settings.remindersOn')

  return (
    <section className="card stack" aria-labelledby="reminders-title">
      <h2 id="reminders-title" className="h2">
        {t('settings.notifications')}
      </h2>
      <p className="muted">{message}</p>
      {status?.permission === 'prompt' && (
        <button
          type="button"
          className="button button-primary"
          disabled={request.isPending}
          onClick={() => request.mutate()}
        >
          {t('settings.notificationsEnable')}
        </button>
      )}
      {status?.permission === 'granted' && !status.exact && (
        <>
          <p className="muted">{t('settings.remindersInexact')}</p>
          <button
            type="button"
            className="button button-secondary"
            disabled={exact.isPending}
            onClick={() => exact.mutate()}
          >
            {t('settings.remindersExact')}
          </button>
        </>
      )}
    </section>
  )
}
