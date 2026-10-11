import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCurrentUser } from '../../auth/auth'
import { intlLocale, isLanguage } from '../../i18n'
import { DEFAULT_TIMEZONE, formatLongDate, greetingKey } from '../../lib/date'

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { data: user } = useCurrentUser()
  const now = useNow()
  const timeZone = user?.timezone ?? DEFAULT_TIMEZONE
  const locale = intlLocale(isLanguage(i18n.language) ? i18n.language : undefined)
  const greeting = t(greetingKey(now, timeZone))

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <p className="eyebrow">{formatLongDate(now, locale, timeZone)}</p>
        <h1 className="h1">{user ? t('greeting.withName', { greeting, name: user.displayName }) : greeting}</h1>
      </header>

      <section className="card empty-state" aria-labelledby="empty-title">
        <h2 id="empty-title" className="h2">
          {t('dashboard.emptyTitle')}
        </h2>
        <p className="muted">{t('dashboard.emptyBody')}</p>
      </section>
    </div>
  )
}
