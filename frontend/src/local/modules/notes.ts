import { conflict, notFound, Validator } from '../errors'
import { route, type LocalContext, type LocalRequest } from '../router'
import { normalizeSearch, normalizeTags, searchTerms } from '../search'
import { asBody, text } from '../values'

/** Notas: la misma lógica que NoteService del servidor. */

const VIEWS = ['ACTIVE', 'FAVORITES', 'ARCHIVED', 'TRASH'] as const
const EXCERPT_LENGTH = 240
const TAG_MAX_LENGTH = 40
/** Las notas pasan 30 días en la papelera antes de borrarse para siempre. */
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

interface NoteRow {
  id: string
  title: string
  body: string
  state: 'ACTIVE' | 'ARCHIVED' | 'TRASHED'
  pinned: number
  favorite: number
  search_text: string
  trashed_at: string | null
  created_at: string
  updated_at: string
}

function tagsOf(ctx: LocalContext, noteId: string): string[] {
  return ctx.db
    .all<{ name: string }>('select name from note_tag where note_id = ?', [noteId])
    .map((t) => t.name)
    .sort(byCodePoint)
}

function taskIdsOf(ctx: LocalContext, noteId: string): string[] {
  return ctx.db
    .all<{ task_id: string }>('select task_id from note_task where note_id = ? order by position', [noteId])
    .map((t) => t.task_id)
}

function byCodePoint(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Resumen de las tareas indicadas, como TaskService.refs. */
function taskRefs(ctx: LocalContext, ids: string[]) {
  if (ids.length === 0) return new Map<string, unknown>()
  const rows = ctx.db.all<{ id: string; title: string; kind: string; status: string; due_date: string | null }>(
    `select id, title, kind, status, due_date from task where id in (${ids.map(() => '?').join(',')})`,
    ids,
  )
  return new Map(
    rows.map((t) => [t.id, { id: t.id, title: t.title, kind: t.kind, status: t.status, dueDate: t.due_date }]),
  )
}

function toResponse(ctx: LocalContext, note: NoteRow) {
  const taskIds = taskIdsOf(ctx, note.id)
  const refs = taskRefs(ctx, taskIds)
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    tags: tagsOf(ctx, note.id),
    pinned: note.pinned === 1,
    favorite: note.favorite === 1,
    state: note.state,
    tasks: taskIds.map((id) => refs.get(id)).filter((ref) => ref !== undefined),
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    trashedAt: note.trashed_at,
  }
}

function toSummary(ctx: LocalContext, note: NoteRow) {
  const body = note.body.trim()
  const excerpt = body.length <= EXCERPT_LENGTH ? body : body.slice(0, EXCERPT_LENGTH).trimEnd() + '…'
  return {
    id: note.id,
    title: note.title,
    excerpt,
    tags: tagsOf(ctx, note.id),
    pinned: note.pinned === 1,
    favorite: note.favorite === 1,
    state: note.state,
    taskCount: taskIdsOf(ctx, note.id).length,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    trashedAt: note.trashed_at,
  }
}

function load(ctx: LocalContext, id: string): NoteRow {
  const note = ctx.db.get<NoteRow>('select * from note where id = ?', [id])
  if (!note) throw notFound()
  return note
}

/** Las notas de la papelera solo se pueden restaurar o borrar. */
function loadEditable(ctx: LocalContext, id: string): NoteRow {
  const note = load(ctx, id)
  if (note.state === 'TRASHED') throw conflict('note-in-trash')
  return note
}

function respond(ctx: LocalContext, id: string) {
  return toResponse(ctx, load(ctx, id))
}

function list({ ctx, query }: LocalRequest) {
  const requested = query.get('view') ?? 'ACTIVE'
  const view = (VIEWS as readonly string[]).includes(requested) ? requested : 'ACTIVE'
  const where =
    view === 'ACTIVE'
      ? "state = 'ACTIVE'"
      : view === 'ARCHIVED'
        ? "state = 'ARCHIVED'"
        : view === 'TRASH'
          ? "state = 'TRASHED'"
          : "state <> 'TRASHED' and favorite = 1"
  const order = view === 'TRASH' ? 'trashed_at desc' : 'pinned desc, updated_at desc'
  const pinned = query.get('pinned')
  const tag = query.get('tag')
  const taskId = query.get('taskId')
  const terms = searchTerms(query.get('q'))
  const normalizedTag = tag && tag.trim() ? (normalizeTags([tag])[0] ?? '') : null
  return ctx.db
    .all<NoteRow>(`select * from note where ${where} order by ${order}`)
    .filter((note) => pinned === null || (note.pinned === 1) === (pinned === 'true'))
    .filter((note) => normalizedTag === null || tagsOf(ctx, note.id).includes(normalizedTag))
    .filter((note) => !taskId || taskIdsOf(ctx, note.id).includes(taskId))
    .filter((note) => terms.every((term) => note.search_text.includes(term)))
    .map((note) => toSummary(ctx, note))
}

function tags({ ctx }: LocalRequest) {
  return ctx.db
    .all<{ name: string; count: number }>(
      `select t.name as name, count(*) as count from note_tag t join note n on n.id = t.note_id
       where n.state <> 'TRASHED' group by t.name`,
    )
    .sort((a, b) => byCodePoint(a.name, b.name))
}

interface NoteInput {
  title: string
  body: string
  tags: string[]
  taskIds: string[]
}

function stringList(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

/** Validaciones de NoteRequest y de NoteService.apply. */
function readNote(ctx: LocalContext, raw: unknown): NoteInput {
  const body = asBody(raw)
  const title = text(body, 'title')
  const content = text(body, 'body')
  const rawTags = stringList(body.tags)
  const rawTasks = stringList(body.taskIds)
  new Validator()
    .add((title ?? '').length > 200, 'title', 'note.title.too-long')
    .add((content ?? '').length > 100_000, 'body', 'note.body.too-long')
    .add((rawTags ?? []).length > 20, 'tags', 'note.tags.too-many')
    .add((rawTasks ?? []).length > 20, 'taskIds', 'note.tasks.too-many')
    .throwIfAny()
  const input: NoteInput = {
    title: (title ?? '').trim(),
    body: (content ?? '').trimEnd(),
    tags: normalizeTags((rawTags ?? []).filter((t): t is string => typeof t === 'string')),
    taskIds: [...new Set((rawTasks ?? []).filter((t): t is string => typeof t === 'string'))],
  }
  const found = taskRefs(ctx, input.taskIds)
  new Validator()
    .add(input.title === '' && input.body.trim() === '', 'body', 'note.empty')
    .add(
      input.tags.some((t) => t.length > TAG_MAX_LENGTH),
      'tags',
      'note.tags.too-long',
    )
    .add(found.size !== input.taskIds.length, 'taskIds', 'note.tasks.invalid')
    .throwIfAny()
  return input
}

function edit(ctx: LocalContext, id: string, input: NoteInput, isNew: boolean) {
  const now = ctx.now().toISOString()
  const searchText = normalizeSearch(`${input.title}\n${input.body}\n${input.tags.join(' ')}`)
  if (isNew) {
    ctx.db.run(
      `insert into note (id, title, body, state, pinned, favorite, search_text, created_at, updated_at)
       values (?, ?, ?, 'ACTIVE', 0, 0, ?, ?, ?)`,
      [id, input.title, input.body, searchText, now, now],
    )
  } else {
    ctx.db.run('update note set title = ?, body = ?, search_text = ?, updated_at = ? where id = ?', [
      input.title,
      input.body,
      searchText,
      now,
      id,
    ])
    ctx.db.run('delete from note_tag where note_id = ?', [id])
    ctx.db.run('delete from note_task where note_id = ?', [id])
  }
  input.tags.forEach((tag) => ctx.db.run('insert into note_tag (note_id, name) values (?, ?)', [id, tag]))
  input.taskIds.forEach((taskId, position) =>
    ctx.db.run('insert into note_task (note_id, task_id, position) values (?, ?, ?)', [id, taskId, position]),
  )
  return respond(ctx, id)
}

function setFlags({ ctx, params, body }: LocalRequest) {
  const note = loadEditable(ctx, params.id)
  const changes = asBody(body)
  if (typeof changes.pinned === 'boolean') {
    if (changes.pinned && note.state === 'ARCHIVED') throw conflict('note-archived')
    ctx.db.run('update note set pinned = ? where id = ?', [changes.pinned ? 1 : 0, note.id])
  }
  if (typeof changes.favorite === 'boolean') {
    ctx.db.run('update note set favorite = ? where id = ?', [changes.favorite ? 1 : 0, note.id])
  }
  return respond(ctx, note.id)
}

function changeState(sql: string, editableOnly: boolean) {
  return ({ ctx, params }: LocalRequest) => {
    const note = editableOnly ? loadEditable(ctx, params.id) : load(ctx, params.id)
    ctx.db.run(sql, [note.id])
    return respond(ctx, note.id)
  }
}

/** Borra las notas que llevan más de 30 días en la papelera (en el servidor lo hace NoteTrashCleaner). */
export function purgeExpiredTrash(ctx: LocalContext): number {
  const before = new Date(ctx.now().getTime() - TRASH_RETENTION_MS).toISOString()
  const expired = ctx.db.all<{ id: string }>("select id from note where state = 'TRASHED' and trashed_at < ?", [before])
  expired.forEach((note) => ctx.db.run('delete from note where id = ?', [note.id]))
  return expired.length
}

export const noteRoutes = [
  route('GET', '/api/notes', list),
  route('GET', '/api/note-tags', tags),
  route('GET', '/api/notes/:id', ({ ctx, params }) => respond(ctx, params.id)),
  route('POST', '/api/notes', ({ ctx, body }) => edit(ctx, ctx.uuid(), readNote(ctx, body), true), 201),
  route('PUT', '/api/notes/:id', ({ ctx, params, body }) => {
    const note = loadEditable(ctx, params.id)
    return edit(ctx, note.id, readNote(ctx, body), false)
  }),
  route('PATCH', '/api/notes/:id', setFlags),
  route('POST', '/api/notes/:id/archive', changeState("update note set state = 'ARCHIVED', pinned = 0 where id = ?", true)),
  route('POST', '/api/notes/:id/unarchive', changeState("update note set state = 'ACTIVE' where id = ?", true)),
  route('POST', '/api/notes/:id/trash', ({ ctx, params }) => {
    const note = load(ctx, params.id)
    if (note.state !== 'TRASHED') {
      ctx.db.run("update note set state = 'TRASHED', pinned = 0, trashed_at = ? where id = ?", [
        ctx.now().toISOString(),
        note.id,
      ])
    }
    return respond(ctx, note.id)
  }),
  route('POST', '/api/notes/:id/restore', changeState("update note set state = 'ACTIVE', trashed_at = null where id = ?", false)),
  // Antes que DELETE /api/notes/:id, para que «trash» no se tome por un identificador.
  route('DELETE', '/api/notes/trash', ({ ctx }) => {
    ctx.db.run("delete from note where state = 'TRASHED'")
  }),
  route('DELETE', '/api/notes/:id', ({ ctx, params }) => {
    const note = load(ctx, params.id)
    if (note.state !== 'TRASHED') throw conflict('note-not-in-trash')
    ctx.db.run('delete from note where id = ?', [note.id])
  }),
]
