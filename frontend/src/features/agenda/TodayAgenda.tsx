import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { ApiError } from '../../api/client'
import { useDateFormat } from '../../lib/useRelativeDate'
import { useToast } from '../../ui/toast-context'
import { AgendaItemRow } from './AgendaItemRow'
import { useAgenda, useSetStatus } from './api'
import { coversDay, findOverlaps, itemKey } from './schedule'

/** Actividades de hoy en la pantalla Hoy (los entrenos ya tienen su propia sección). Sin actividades, no se muestra. */
export function TodayAgenda() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { today } = useDateFormat()
  const agenda = useAgenda(today, today)
  const setStatus = useSetStatus()
  const items = (agenda.data ?? []).filter((item) => item.kind === 'ACTIVITY' && coversDay(item, today))
  if (items.length === 0) return null
  const overlaps = findOverlaps(items)

  return (
    <section className="stack-sm" aria-labelledby="today-agenda-title">
      <div className="section-header">
        <h2 id="today-agenda-title" className="h2">
          {t('agenda.today.title')}
        </h2>
        <Link to="/agenda?vista=DAY" className="link">
          {t('common.seeAll')}
        </Link>
      </div>
      <ul className="card list-plain agenda-list">
        {items.map((item) => (
          <AgendaItemRow
            key={itemKey(item)}
            item={item}
            day={today}
            overlap={overlaps.has(itemKey(item))}
            onOpen={() => navigate(`/agenda?vista=DAY&actividad=${item.id}&dia=${item.date}`)}
            onStatus={(target, status) =>
              setStatus.mutate(
                { id: target.id, date: target.date, status },
                {
                  onSuccess: () => toast(t('agenda.statusSaved', { status: t(`agenda.status.${status}`) })),
                  onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
                },
              )
            }
          />
        ))}
      </ul>
    </section>
  )
}
