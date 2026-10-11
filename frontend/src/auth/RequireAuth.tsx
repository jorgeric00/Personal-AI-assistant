import { Navigate, Outlet, useLocation } from 'react-router'

import { useCurrentUser } from './auth'

export function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useCurrentUser()
  const location = useLocation()

  if (isPending) {
    return (
      <div className="screen-center" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span className="visually-hidden">Cargando…</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="screen-center">
        <div className="card stack">
          <h1 className="h2">No se ha podido conectar</h1>
          <p className="muted">El servidor no responde. Comprueba tu conexión e inténtalo de nuevo.</p>
          <button className="button button-primary" onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}
