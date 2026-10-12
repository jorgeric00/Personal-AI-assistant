import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useToast } from '../../ui/toast-context'
import { useDisablePush, useEnablePush, usePushState, useTestPush } from './push'

export function NotificationSettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const { status } = usePushState()
  const enable = useEnablePush()
  const disable = useDisablePush()
  const test = useTestPush()

  const message = {
    loading: t('common.loading'),
    unsupported: t('settings.notificationsUnsupported'),
    'ios-install': t('settings.notificationsIosInstall'),
    insecure: t('settings.notificationsInsecure'),
    denied: t('settings.notificationsDenied'),
    off: t('settings.notificationsOff'),
    on: t('settings.notificationsOn'),
  }[status]

  return (
    <section className="card stack" aria-labelledby="notifications-title">
      <h2 id="notifications-title" className="h2">
        {t('settings.notifications')}
      </h2>
      <p className="muted">{message}</p>
      {enable.isError && (
        <p className="field-error" role="alert">
          {enable.error instanceof ApiError ? enable.error.message : t('settings.notificationsError')}
        </p>
      )}
      {status === 'off' && (
        <button
          type="button"
          className="button button-primary"
          disabled={enable.isPending}
          onClick={() => enable.mutate()}
        >
          {t('settings.notificationsEnable')}
        </button>
      )}
      {status === 'on' && (
        <div className="inline-form">
          <button
            type="button"
            className="button button-secondary"
            disabled={test.isPending}
            onClick={() =>
              test.mutate(undefined, {
                onSuccess: () => toast(t('settings.notificationsTestSent')),
                onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
              })
            }
          >
            {t('settings.notificationsTest')}
          </button>
          <button
            type="button"
            className="button button-ghost"
            disabled={disable.isPending}
            onClick={() => disable.mutate()}
          >
            {t('settings.notificationsDisable')}
          </button>
        </div>
      )}
    </section>
  )
}
