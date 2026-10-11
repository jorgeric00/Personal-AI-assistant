import { useTranslation } from 'react-i18next'

import { useDateFormat } from '../../lib/useRelativeDate'
import { PinIcon, StarIcon } from '../../ui/icons'
import type { NoteSummary } from './api'

interface NoteCardProps {
  note: NoteSummary
  onOpen: (id: string) => void
}

export function NoteCard({ note, onOpen }: NoteCardProps) {
  const { t } = useTranslation()
  const { relativeInstant } = useDateFormat()
  const title = note.title || note.excerpt.split('\n')[0]
  const excerpt = note.title ? note.excerpt : note.excerpt.split('\n').slice(1).join('\n')

  return (
    <li>
      <button type="button" className="note-card" onClick={() => onOpen(note.id)}>
        <span className="note-card-head">
          <span className="note-card-title">{title || t('notes.untitled')}</span>
          {note.pinned && (
            <span className="note-flag" title={t('notes.pinned')}>
              <PinIcon filled />
              <span className="visually-hidden">{t('notes.pinned')}</span>
            </span>
          )}
          {note.favorite && (
            <span className="note-flag" title={t('notes.favorite')}>
              <StarIcon filled />
              <span className="visually-hidden">{t('notes.favorite')}</span>
            </span>
          )}
        </span>
        {excerpt && <span className="note-card-excerpt">{excerpt}</span>}
        <span className="note-card-meta">
          <span>{relativeInstant(note.trashedAt ?? note.updatedAt)}</span>
          {note.tags.map((tag) => (
            <span key={tag} className="tag tag-small">
              #{tag}
            </span>
          ))}
        </span>
      </button>
    </li>
  )
}
