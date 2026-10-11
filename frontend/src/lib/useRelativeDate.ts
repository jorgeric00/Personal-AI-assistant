import { useTranslation } from 'react-i18next'

import { useCurrentUser } from '../auth/auth'
import { intlLocale, isLanguage } from '../i18n'
import { DEFAULT_TIMEZONE, daysBetween, formatShortDate, formatTime, todayIso } from './date'

/** Formateo de fechas relativo a hoy («Hoy», «Mañana», «lun, 13 oct») en el idioma y la zona del usuario. */
export function useDateFormat() {
  const { t, i18n } = useTranslation()
  const { data: user } = useCurrentUser()
  const timeZone = user?.timezone ?? DEFAULT_TIMEZONE
  const locale = intlLocale(isLanguage(i18n.language) ? i18n.language : undefined)
  const today = todayIso(timeZone)

  const relativeDate = (iso: string) => {
    const diff = daysBetween(today, iso)
    if (diff === 0) return t('dates.today')
    if (diff === 1) return t('dates.tomorrow')
    if (diff === -1) return t('dates.yesterday')
    return formatShortDate(iso, locale)
  }

  const dateTime = (iso: string | null, time: string | null) => {
    if (!iso) return t('dates.noDate')
    return time ? t('dates.atTime', { date: relativeDate(iso), time: formatTime(time) }) : relativeDate(iso)
  }

  return { today, timeZone, locale, relativeDate, dateTime }
}
