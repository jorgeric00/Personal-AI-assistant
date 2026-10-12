import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { formatInstant } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { ArchiveIcon, CloseIcon, PinIcon, StarIcon, TrashIcon } from '../../ui/icons'
import { useTasks } from '../tasks/api'
import { useNoteMutations, useNoteTags, type Note, type NoteInput } from './api'
import { TagInput } from '../../ui/TagInput'
import { useAutosave } from './useAutosave'

interface NoteEditorProps {
  note: Note | null
  /** Tarea con la que se relaciona una nota nueva (al crearla desde una tarea). */
  initialTaskId?: string | null
  onClose: () => void
}

interface LinkedTask {
  id: string
  title: string
}

export function NoteEditor({ note, initialTaskId = null, onClose }: NoteEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { locale, timeZone } = useDateFormat()
  const tags = useNoteTags()
  const openTasks = useTasks('ALL')
  const { action, flags, remove } = useNoteMutations()

  const trashed = note?.state === 'TRASHED'
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [noteTags, setNoteTags] = useState<string[]>(note?.tags ?? [])
  const [linked, setLinked] = useState<LinkedTask[]>(note?.tasks ?? [])
  const [pendingTaskId] = useState(initialTaskId)
  const [pinned, setPinned] = useState(note?.pinned ?? false)
  const [favorite, setFavorite] = useState(note?.favorite ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // La tarea de origen se relaciona en cuanto se conoce su título.
  const originTask = pendingTaskId ? openTasks.data?.find((task) => task.id === pendingTaskId) : undefined
  const linkedTasks = useMemo(
    () =>
      originTask && !linked.some((task) => task.id === originTask.id)
        ? [...linked, { id: originTask.id, title: originTask.title }]
        : linked,
    [linked, originTask],
  )

  const input: NoteInput = useMemo(
    () => ({ title, body, tags: noteTags, taskIds: linkedTasks.map((task) => task.id) }),
    [title, body, noteTags, linkedTasks],
  )
  const { noteId, status, error, flush } = useAutosave(note, input, !trashed)

  const close = () => {
    void flush()
    onClose()
  }

  const runAction = async (kind: 'archive' | 'unarchive' | 'trash') => {
    if (!noteId) return
    await flush()
    const undo = kind === 'archive' ? 'unarchive' : kind === 'trash' ? 'restore' : null
    action.mutate(
      { id: noteId, action: kind },
      {
        onSuccess: () => {
          onClose()
          toast(t(`notes.toast.${kind}`), {
            action: undo ? { label: t('common.undo'), onClick: () => action.mutate({ id: noteId, action: undo }) } : undefined,
          })
        },
        onError: (e) => toast(e.message, { tone: 'error' }),
      },
    )
  }

  const toggle = (change: { pinned?: boolean; favorite?: boolean }) => {
    if (!noteId) return
    if (change.pinned !== undefined) setPinned(change.pinned)
    if (change.favorite !== undefined) setFavorite(change.favorite)
    flags.mutate(
      { id: noteId, ...change },
      {
        onError: (e) => {
          setPinned(note?.pinned ?? false)
          setFavorite(note?.favorite ?? false)
          toast(e.message, { tone: 'error' })
        },
      },
    )
  }

  const openTask = async (id: string) => {
    await flush()
    navigate(`/tareas?tarea=${id}`)
  }

  const statusText =
    status === 'saving'
      ? t('common.saving')
      : status === 'saved'
        ? t('common.saved')
        : status === 'error'
          ? (Object.values(error?.fieldErrors ?? {})[0] ?? error?.message ?? t('notes.saveError'))
          : ''

  const availableTasks = (openTasks.data ?? []).filter((task) => !linkedTasks.some((item) => item.id === task.id))
  const archived = note?.state === 'ARCHIVED'

  return (
    <Sheet
      title={noteId ? t('notes.edit') : t('notes.new')}
      onClose={close}
      tall
      headerActions={
        !trashed && (
          <>
            <button
              type="button"
              className="icon-button"
              aria-pressed={pinned}
              aria-label={t('notes.pin')}
              title={archived ? t('notes.pinArchived') : t('notes.pin')}
              disabled={!noteId || archived}
              onClick={() => toggle({ pinned: !pinned })}
            >
              <PinIcon filled={pinned} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-pressed={favorite}
              aria-label={t('notes.favorite')}
              disabled={!noteId}
              onClick={() => toggle({ favorite: !favorite })}
            >
              <StarIcon filled={favorite} />
            </button>
          </>
        )
      }
      footer={
        trashed ? (
          confirmDelete ? (
            <>
              <button type="button" className="button button-secondary" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={() =>
                  remove.mutate(note.id, {
                    onSuccess: () => {
                      onClose()
                      toast(t('notes.toast.deleted'))
                    },
                  })
                }
              >
                {t('notes.deleteForever')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button button-secondary" onClick={() => setConfirmDelete(true)}>
                {t('notes.deleteForever')}
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() =>
                  action.mutate(
                    { id: note.id, action: 'restore' },
                    { onSuccess: () => toast(t('notes.toast.restore')) },
                  )
                }
              >
                {t('notes.restore')}
              </button>
            </>
          )
        ) : (
          <div className="note-footer">
            <span className={status === 'error' ? 'note-status is-error' : 'note-status'} role="status">
              {statusText}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={archived ? t('notes.unarchive') : t('notes.archive')}
              title={archived ? t('notes.unarchive') : t('notes.archive')}
              disabled={!noteId}
              onClick={() => void runAction(archived ? 'unarchive' : 'archive')}
            >
              <ArchiveIcon />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t('notes.trash')}
              title={t('notes.trash')}
              disabled={!noteId}
              onClick={() => void runAction('trash')}
            >
              <TrashIcon />
            </button>
          </div>
        )
      }
    >
      {trashed && <p className="alert">{t('notes.inTrash')}</p>}
      <input
        className="note-title-input"
        aria-label={t('notes.fields.title')}
        placeholder={t('notes.fields.title')}
        value={title}
        maxLength={200}
        readOnly={trashed}
        onChange={(event) => setTitle(event.target.value)}
        data-autofocus={note ? undefined : true}
      />
      <textarea
        className="note-body-input"
        aria-label={t('notes.fields.body')}
        placeholder={t('notes.fields.bodyPlaceholder')}
        value={body}
        readOnly={trashed}
        onChange={(event) => setBody(event.target.value)}
      />

      <div className="stack-sm">
        <label className="field-label" htmlFor="note-tags">
          {t('notes.fields.tags')}
        </label>
        <TagInput
          id="note-tags"
          value={noteTags}
          onChange={setNoteTags}
          suggestions={(tags.data ?? []).map((tag) => tag.name)}
          readOnly={trashed}
        />
      </div>

      <div className="stack-sm">
        <span className="field-label" id="note-tasks-label">
          {t('notes.fields.tasks')}
        </span>
        {linkedTasks.length > 0 && (
          <ul className="list-plain linked-list" aria-labelledby="note-tasks-label">
            {linkedTasks.map((task) => (
              <li key={task.id} className="linked-item">
                <button type="button" className="link linked-title" onClick={() => void openTask(task.id)}>
                  {task.title}
                </button>
                {!trashed && (
                  <button
                    type="button"
                    className="icon-button icon-button-small"
                    aria-label={t('notes.tasks.unlink', { title: task.title })}
                    onClick={() => setLinked(linkedTasks.filter((item) => item.id !== task.id))}
                  >
                    <CloseIcon />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!trashed && (
          <select
            className="select"
            aria-label={t('notes.tasks.link')}
            value=""
            onChange={(event) => {
              const task = availableTasks.find((item) => item.id === event.target.value)
              if (task) setLinked([...linkedTasks, { id: task.id, title: task.title }])
            }}
          >
            <option value="">{availableTasks.length ? t('notes.tasks.link') : t('notes.tasks.none')}</option>
            {availableTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {note && (
        <p className="note-dates muted">
          {t('notes.created', { date: formatInstant(note.createdAt, locale, timeZone) })}
          <br />
          {t('notes.updated', { date: formatInstant(note.updatedAt, locale, timeZone) })}
        </p>
      )}
    </Sheet>
  )
}
