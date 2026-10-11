import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { PlusIcon } from '../../ui/icons'
import { useNotes } from './api'

/** Notas relacionadas con una tarea, con acceso para crear una nueva ya relacionada. */
export function RelatedNotes({ taskId }: { taskId: string }) {
  const { t } = useTranslation()
  const notes = useNotes('ACTIVE', { taskId })

  return (
    <section className="sheet-section stack-sm" aria-labelledby="related-notes-title">
      <h3 id="related-notes-title" className="field-label">
        {t('tasks.relatedNotes')}
      </h3>
      {(notes.data?.length ?? 0) > 0 && (
        <ul className="list-plain linked-list">
          {notes.data!.map((note) => (
            <li key={note.id} className="linked-item">
              <Link to={`/notas?nota=${note.id}`} className="link linked-title">
                {note.title || note.excerpt.split('\n')[0] || t('notes.untitled')}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/notas?nueva=1&tarea=${taskId}`} className="button button-secondary button-small">
        <PlusIcon />
        {t('tasks.addNote')}
      </Link>
    </section>
  )
}
