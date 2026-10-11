import type { ParseKeys } from 'i18next'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { PlusIcon, SearchIcon } from '../../ui/icons'
import { useToast } from '../../ui/toast-context'
import { NOTE_VIEWS, TRASH_RETENTION_DAYS, useNote, useNoteMutations, useNotes, useNoteTags, type NoteView } from './api'
import { NoteCard } from './NoteCard'
import { NoteEditor } from './NoteEditor'

const VIEW_LABELS: Record<NoteView, ParseKeys> = {
  ACTIVE: 'notes.views.active',
  FAVORITES: 'notes.views.favorites',
  ARCHIVED: 'notes.views.archived',
  TRASH: 'notes.views.trash',
}

const EMPTY: Record<NoteView, ParseKeys> = {
  ACTIVE: 'notes.empty.active',
  FAVORITES: 'notes.empty.favorites',
  ARCHIVED: 'notes.empty.archived',
  TRASH: 'notes.empty.trash',
}

/** Retrasa un valor para no lanzar una búsqueda por cada tecla. */
function useDebounced<T>(value: T, ms = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

/**
 * Pantalla de notas. El estado vive en la URL (?vista, ?q, ?etiqueta, ?nota, ?nueva, ?tarea) para que los
 * accesos rápidos y los enlaces desde una tarea abran directamente lo que corresponde.
 */
export function NotesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const view = NOTE_VIEWS.find((item) => item === params.get('vista')) ?? 'ACTIVE'
  const tag = params.get('etiqueta') ?? undefined
  const editingId = params.get('nota')
  const creating = params.get('nueva') !== null
  const taskId = params.get('tarea')

  const q = useDebounced(search.trim())
  const notes = useNotes(view, { q: q || undefined, tag })
  const tags = useNoteTags()
  const editing = useNote(editingId)
  const { emptyTrash } = useNoteMutations()

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => (value !== null ? next.set(key, value) : next.delete(key)))
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if ((params.get('q') ?? '') === q) return
    const next = new URLSearchParams(params)
    if (q) next.set('q', q)
    else next.delete('q')
    setParams(next, { replace: true })
  }, [q, params, setParams])

  const list = notes.data ?? []
  const filtered = Boolean(q || tag)

  return (
    <div className="page stack-lg">
      <header className="page-header page-header-row">
        <h1 className="h1">{t('notes.title')}</h1>
        <button type="button" className="button button-primary button-small" onClick={() => update({ nueva: '1' })}>
          <PlusIcon />
          {t('notes.newShort')}
        </button>
      </header>

      <label className="search-field">
        <SearchIcon />
        <span className="visually-hidden">{t('notes.search')}</span>
        <input
          type="search"
          value={search}
          placeholder={t('notes.search')}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <nav className="tabs" aria-label={t('notes.viewsLabel')}>
        {NOTE_VIEWS.map((item) => (
          <button
            key={item}
            type="button"
            className="tab"
            aria-current={view === item ? 'page' : undefined}
            onClick={() => update({ vista: item === 'ACTIVE' ? null : item })}
          >
            {t(VIEW_LABELS[item])}
          </button>
        ))}
      </nav>

      {(tags.data?.length ?? 0) > 0 && view !== 'TRASH' && (
        <div className="chips chips-scroll" role="group" aria-label={t('notes.fields.tags')}>
          {tags.data!.map((item) => (
            <button
              key={item.name}
              type="button"
              className="chip chip-small"
              aria-pressed={tag === item.name}
              onClick={() => update({ etiqueta: tag === item.name ? null : item.name })}
            >
              #{item.name}
            </button>
          ))}
        </div>
      )}

      {view === 'TRASH' && (
        <div className="trash-bar">
          <p className="muted">{t('notes.trashInfo', { count: TRASH_RETENTION_DAYS })}</p>
          {list.length > 0 &&
            (confirmEmpty ? (
              <div className="inline-actions">
                <button type="button" className="button button-secondary button-small" onClick={() => setConfirmEmpty(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="button button-danger button-small"
                  onClick={() =>
                    emptyTrash.mutate(undefined, {
                      onSuccess: () => {
                        setConfirmEmpty(false)
                        toast(t('notes.toast.emptied'))
                      },
                      onError: (e) => toast(e.message, { tone: 'error' }),
                    })
                  }
                >
                  {t('notes.emptyTrashConfirm')}
                </button>
              </div>
            ) : (
              <button type="button" className="button button-secondary button-small" onClick={() => setConfirmEmpty(true)}>
                {t('notes.emptyTrash')}
              </button>
            ))}
        </div>
      )}

      {notes.isPending && (
        <div className="screen-center-inline" role="status">
          <span className="spinner" aria-hidden="true" />
          <span className="visually-hidden">{t('common.loading')}</span>
        </div>
      )}
      {notes.isError && (
        <div className="alert alert-error" role="alert">
          {notes.error.message}
        </div>
      )}
      {notes.isSuccess && list.length === 0 && (
        <div className="card empty-state">
          <p className="muted">{t(filtered ? 'notes.empty.filtered' : EMPTY[view])}</p>
        </div>
      )}
      {list.length > 0 && (
        <ul className="note-grid list-plain" aria-label={t(VIEW_LABELS[view])}>
          {list.map((note) => (
            <NoteCard key={note.id} note={note} onOpen={(id) => update({ nota: id })} />
          ))}
        </ul>
      )}

      {(creating || (editingId && editing.data)) && (
        <NoteEditor
          key={editingId ?? 'new'}
          note={editingId ? (editing.data ?? null) : null}
          initialTaskId={creating ? taskId : null}
          onClose={() => update({ nota: null, nueva: null, tarea: null })}
        />
      )}
    </div>
  )
}
