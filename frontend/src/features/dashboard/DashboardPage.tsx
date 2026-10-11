import { useEffect, useState } from 'react'

import { useCurrentUser } from '../../auth/auth'
import { DEFAULT_TIMEZONE, formatLongDate, greeting } from '../../lib/date'

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function DashboardPage() {
  const { data: user } = useCurrentUser()
  const now = useNow()
  const timeZone = user?.timezone ?? DEFAULT_TIMEZONE

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <p className="eyebrow">{formatLongDate(now, timeZone)}</p>
        <h1 className="h1">
          {greeting(now, timeZone)}
          {user ? `, ${user.displayName}` : ''}
        </h1>
      </header>

      <section className="card empty-state" aria-labelledby="empty-title">
        <h2 id="empty-title" className="h2">
          Tu día aparecerá aquí
        </h2>
        <p className="muted">
          Este es el resumen de hoy. Cuando estén disponibles las tareas, los recordatorios, las notas y las
          finanzas, verás aquí lo que tienes pendiente y podrás añadir cosas con un toque.
        </p>
      </section>
    </div>
  )
}
