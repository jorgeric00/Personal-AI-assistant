import { useTranslation } from 'react-i18next'

import { formatMoney } from '../../lib/money'
import { RepeatIcon } from '../../ui/icons'
import type { Movement } from './api'

export function MovementItem({ movement, locale, onOpen }: { movement: Movement; locale: string; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const sign = movement.kind === 'INCOME' ? 1 : -1
  return (
    <li>
      <button type="button" className="movement-row" onClick={() => onOpen(movement.id)}>
        <span className="category-dot category-dot-large" style={{ background: movement.category.color }} aria-hidden="true" />
        <span className="movement-main">
          <span className="movement-title">
            {movement.recurringId && (
              <span className="movement-recurring" title={t('finance.recurring.badge')}>
                <RepeatIcon />
                <span className="visually-hidden">{t('finance.recurring.badge')}: </span>
              </span>
            )}{' '}
            {movement.description || movement.category.name}
          </span>
          <span className="movement-meta">
            {movement.description ? movement.category.name : null}
            {movement.account ? `${movement.description ? ' · ' : ''}${movement.account.name}` : null}
            {movement.tags.map((tag) => (
              <span key={tag} className="tag tag-small">
                #{tag}
              </span>
            ))}
          </span>
        </span>
        <span className={`movement-amount amount-${movement.kind === 'INCOME' ? 'income' : 'expense'}`}>
          {formatMoney(sign * movement.amountCents, movement.currency, locale, { signed: true })}
        </span>
      </button>
    </li>
  )
}
