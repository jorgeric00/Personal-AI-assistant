import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useCurrentUser } from './auth'

export function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useCurrentUser()
  const location = useLocation()
  const { t } = useTranslation()

  if (isPending) {
    return (
      <div className="screen-center" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="screen-center">
        <div className="card stack">
          <h1 className="h2">{t('errors.connectionTitle')}</h1>
          <p className="muted">{t('errors.connection')}</p>
          <button className="button button-primary" onClick={() => refetch()}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />

  return <Outlet />
}
