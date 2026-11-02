import { daysBetween, isIsoDate, isTime, normalizeTime, plusDays, type WeekdayName, WEEKDAY_NAMES } from '../dates'
import { conflict, LocalError, notFound, Validator } from '../errors'
import { MESSAGES } from '../messages'
import { Recurrence, type Frequency } from '../recurrence'
import { route, type LocalContext, type LocalRequest } from '../router'
import { asBody, blankToNull, int, isBlank, oneOf, text } from '../values'
import { currentLocale, setting } from './account'

/**
 * Agenda: actividades con sus categorías y estados, con la misma lógica que AgendaService del servidor. Los
 * entrenamientos del módulo de entreno se añadirán cuando ese módulo funcione en la app.
 */

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const
const STATUSES = ['PLANNED', 'CONFIRMED', 'DONE', 'MISSED', 'CANCELLED'] as const
/** Rango máximo que se puede pedir de una vez (una cuadrícula mensual son 42 días). */
const MAX_RANGE_DAYS = 62
/** Duración máxima de una aparición (un viaje largo, por ejemplo). */
const MAX_ACTIVITY_DAYS = 60

/** Categorías iniciales, como AgendaSetupService. */
const DEFAULT_CATEGORIES = [
  ['gym', '#0f766e'],
  ['sport', '#16a34a'],
  ['rest', '#6366f1'],
  ['free-time', '#ca8a04'],
  ['friends', '#db2777'],
  ['travel', '#0284c7'],
  ['errands', '#ea580c'],
  ['appointments', '#7c3aed'],
  ['other', '#64748b'],
] as const

interface CategoryRow {
  id: string
  name: string
  color: string
  archived: number
}

interface ActivityRow {
  id: string
  title: string
  category_id: string
  category_name: string
  category_color: string
  start_date: string
  start_time: string | null
  end_date: string
  end_time: string | null
  description: string | null
  location: string | null
  recurrence_frequency: Frequency | null
  recurrence_interval: number | null
  recurrence_weekdays: string | null
  recurrence_until: string | null
}

const SELECT = `
  select a.*, c.name as category_name, c.color as category_color
  from activity a join activity_category c on c.id = a.category_id`

/** Crea las categorías iniciales en el idioma de la app la primera vez; después son de la persona. */
function ensureCategories(ctx: LocalContext) {
  if (setting(ctx, 'agendaCategoriesCreated') !== null) return
  ctx.db.run("insert into app_setting (key, value) values ('agendaCategoriesCreated', 'true')")
  const messages = MESSAGES[currentLocale(ctx) === 'en' ? 'en' : 'es']
  const now = ctx.now().toISOString()
  for (const [key, color] of DEFAULT_CATEGORIES) {
    ctx.db.run('insert into activity_category (id, name, color, archived, created_at) values (?, ?, ?, 0, ?)', [
      ctx.uuid(),
      messages[`agenda.category.default.${key}`],
      color,
      now,
    ])
  }
}

function recurrenceOf(a: ActivityRow): Recurrence | null {
  if (!a.recurrence_frequency) return null
  return new Recurrence(
    a.recurrence_frequency,
    a.recurrence_interval ?? 1,
    Recurrence.parseWeekdays(a.recurrence_weekdays),
    a.start_date,
    a.recurrence_until,
  )
}

/** Fechas de inicio de las apariciones que tocan algún día entre from y to. */
function occurrencesTouching(a: ActivityRow, from: string, to: string): string[] {
  const earliestStart = plusDays(from, -daysBetween(a.start_date, a.end_date))
  const recurrence = recurrenceOf(a)
  if (!recurrence) return a.start_date > to || a.start_date < earliestStart ? [] : [a.start_date]
  return recurrence.occurrencesBetween(a.start_date, earliestStart, to)
}

function categoryRef(a: ActivityRow) {
  return { id: a.category_id, name: a.category_name, color: a.category_color }
}

function toResponse(a: ActivityRow) {
  const r = recurrenceOf(a)
  return {
    id: a.id,
    title: a.title,
    category: categoryRef(a),
    startDate: a.start_date,
    startTime: a.start_time,
    endDate: a.end_date,
    endTime: a.end_time,
    description: a.description,
    location: a.location,
    recurrence: r && { frequency: r.frequency, interval: r.interval, weekdays: r.weekdays, until: r.until },
  }
}

function load(ctx: LocalContext, id: string): ActivityRow {
  const activity = ctx.db.get<ActivityRow>(`${SELECT} where a.id = ?`, [id])
  if (!activity) throw notFound()
  return activity
}

function agenda({ ctx, query }: LocalRequest) {
  const from = query.get('from')
  const to = query.get('to')
  new Validator()
    .add(!isIsoDate(from), 'from', 'agenda.range.invalid')
    .add(!isIsoDate(to), 'to', 'agenda.range.invalid')
    .throwIfAny()
  new Validator()
    .add(to! < from! || daysBetween(from!, to!) >= MAX_RANGE_DAYS, 'to', 'agenda.range.invalid')
    .throwIfAny()
  const candidates = ctx.db.all<ActivityRow>(
    `${SELECT} where a.start_date <= ? and (a.recurrence_frequency is not null or a.end_date >= ?)`,
    [to, from],
  )
  const statuses = new Map(
    ctx.db
      .all<{ activity_id: string; date: string; status: string }>('select activity_id, date, status from activity_occurrence')
      .map((o) => [`${o.activity_id}|${o.date}`, o.status]),
  )
  const items = candidates.flatMap((a) =>
    occurrencesTouching(a, from!, to!).map((start) => ({
      kind: 'ACTIVITY',
      id: a.id,
      date: start,
      title: a.title,
      category: categoryRef(a),
      startDate: start,
      startTime: a.start_time,
      endDate: plusDays(start, daysBetween(a.start_date, a.end_date)),
      endTime: a.end_time,
      location: a.location,
      status: statuses.get(`${a.id}|${start}`) ?? 'PLANNED',
      recurring: a.recurrence_frequency !== null,
    })),
  )
  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
  )
}

interface ActivityInput {
  title: string
  categoryId: string | null
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
  description: string | null
  location: string | null
  recurrence: { frequency: Frequency; interval: number; weekdays: WeekdayName[]; until: string | null } | null
}

/** Validaciones de ActivityRequest y de AgendaService.apply. */
function readActivity(ctx: LocalContext, raw: unknown, current: ActivityRow | null): ActivityInput {
  const body = asBody(raw)
  const title = text(body, 'title')
  const categoryId = text(body, 'categoryId')
  const startDate = isIsoDate(body.startDate) ? body.startDate : null
  const endDate = isIsoDate(body.endDate) ? body.endDate : null
  const description = text(body, 'description')
  const location = text(body, 'location')
  const rawRecurrence = body.recurrence ? asBody(body.recurrence) : null
  const frequency = rawRecurrence ? oneOf(rawRecurrence, 'frequency', FREQUENCIES) : null
  const interval = rawRecurrence ? int(rawRecurrence, 'interval') : null
  new Validator()
    .add(isBlank(title), 'title', 'agenda.activity.title.required')
    .add((title ?? '').length > 200, 'title', 'agenda.text.too-long')
    .add(categoryId === null, 'categoryId', 'agenda.activity.category.required')
    .add(startDate === null, 'startDate', 'agenda.activity.start.required')
    .add(endDate === null, 'endDate', 'agenda.activity.end.required')
    .add((description ?? '').length > 2000, 'description', 'agenda.text.too-long')
    .add((location ?? '').length > 200, 'location', 'agenda.text.too-long')
    .add(rawRecurrence !== null && frequency === null, 'recurrence.frequency', 'task.recurrence.frequency.required')
    .add(
      rawRecurrence !== null && (interval === null || interval < 1 || interval > 365),
      'recurrence.interval',
      'task.recurrence.interval.invalid',
    )
    .throwIfAny()

  const startTime = isTime(body.startTime) ? normalizeTime(body.startTime) : null
  const endTime = isTime(body.endTime) ? normalizeTime(body.endTime) : null
  const weekdays = Array.isArray(rawRecurrence?.weekdays)
    ? WEEKDAY_NAMES.filter((day) => (rawRecurrence.weekdays as unknown[]).includes(day))
    : []
  const until = rawRecurrence && isIsoDate(rawRecurrence.until) ? rawRecurrence.until : null
  const category = ctx.db.get<CategoryRow>('select * from activity_category where id = ?', [categoryId])
  // Una categoría archivada solo vale si la actividad ya la tenía.
  const usable = category !== undefined && (category.archived === 0 || current?.category_id === category.id)
  new Validator()
    .add(!usable, 'categoryId', 'agenda.activity.category.required')
    .add((startTime === null) !== (endTime === null), startTime === null ? 'startTime' : 'endTime', 'agenda.activity.time.both')
    .add(
      endDate! < startDate! || (endDate === startDate && startTime !== null && endTime !== null && endTime <= startTime),
      'endDate',
      'agenda.activity.end.before-start',
    )
    .add(daysBetween(startDate!, endDate!) > MAX_ACTIVITY_DAYS, 'endDate', 'agenda.activity.too-long')
    .add(weekdays.length > 0 && frequency !== 'WEEKLY', 'recurrence', 'task.recurrence.weekdays-only-weekly')
    .add(until !== null && until < startDate!, 'recurrence', 'task.recurrence.until-before-start')
    .throwIfAny()
  return {
    title: title!.trim(),
    categoryId,
    startDate: startDate!,
    startTime,
    endDate: endDate!,
    endTime,
    description: blankToNull(description),
    location: blankToNull(location),
    recurrence: rawRecurrence ? { frequency: frequency!, interval: interval!, weekdays, until } : null,
  }
}

function saveActivity(ctx: LocalContext, id: string, input: ActivityInput, isNew: boolean) {
  const r = input.recurrence
  const values = [
    input.title,
    input.categoryId,
    input.startDate,
    input.startTime,
    input.endDate,
    input.endTime,
    input.description,
    input.location,
    r?.frequency ?? null,
    r?.interval ?? null,
    r && r.weekdays.length > 0 ? r.weekdays.join(',') : null,
    r?.until ?? null,
    ctx.now().toISOString(),
    id,
  ]
  if (isNew) {
    ctx.db.run(
      `insert into activity (title, category_id, start_date, start_time, end_date, end_time, description, location,
         recurrence_frequency, recurrence_interval, recurrence_weekdays, recurrence_until, updated_at, id, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...values, ctx.now().toISOString()],
    )
  } else {
    ctx.db.run(
      `update activity set title = ?, category_id = ?, start_date = ?, start_time = ?, end_date = ?, end_time = ?,
         description = ?, location = ?, recurrence_frequency = ?, recurrence_interval = ?, recurrence_weekdays = ?,
         recurrence_until = ?, updated_at = ? where id = ?`,
      values,
    )
  }
  return toResponse(load(ctx, id))
}

/** Guarda el estado de una aparición; volver a «planificada» borra el estado guardado. */
function setStatus({ ctx, params, body }: LocalRequest) {
  const activity = load(ctx, params.id)
  const date = params.date
  if (!isIsoDate(date)) throw new LocalError(400, 'validation')
  const status = oneOf(asBody(body), 'status', STATUSES)
  new Validator().add(status === null, 'status', 'agenda.status.required').throwIfAny()
  if (!occurrencesTouching(activity, date, date).includes(date)) throw notFound()
  if (status === 'PLANNED') {
    ctx.db.run('delete from activity_occurrence where activity_id = ? and date = ?', [activity.id, date])
    return
  }
  ctx.db.run(
    `insert into activity_occurrence (activity_id, date, status, updated_at) values (?, ?, ?, ?)
     on conflict (activity_id, date) do update set status = excluded.status, updated_at = excluded.updated_at`,
    [activity.id, date, status, ctx.now().toISOString()],
  )
}

function usedCategoryIds(ctx: LocalContext): Set<string> {
  return new Set(ctx.db.all<{ id: string }>('select distinct category_id as id from activity').map((r) => r.id))
}

function categoryResponse(c: CategoryRow, used: Set<string>) {
  return { id: c.id, name: c.name, color: c.color, archived: c.archived === 1, inUse: used.has(c.id) }
}

function loadCategory(ctx: LocalContext, id: string): CategoryRow {
  const category = ctx.db.get<CategoryRow>('select * from activity_category where id = ?', [id])
  if (!category) throw notFound()
  return category
}

function readCategory(ctx: LocalContext, raw: unknown, excludeId: string | null) {
  const body = asBody(raw)
  const name = text(body, 'name')
  const color = text(body, 'color')
  new Validator()
    .add(isBlank(name), 'name', 'agenda.category.name.required')
    .add((name ?? '').length > 50, 'name', 'agenda.category.name.too-long')
    .add(color === null || !/^#[0-9a-fA-F]{6}$/.test(color), 'color', 'agenda.category.color.invalid')
    .throwIfAny()
  const trimmed = name!.trim()
  const taken = ctx.db
    .all<CategoryRow>('select * from activity_category')
    .some((c) => c.id !== excludeId && c.name.toLowerCase() === trimmed.toLowerCase())
  new Validator().add(taken, 'name', 'agenda.category.name.duplicate').throwIfAny()
  return { name: trimmed, color: color!.toLowerCase(), archived: body.archived === true }
}

export const agendaRoutes = [
  route('GET', '/api/agenda', agenda),
  route('GET', '/api/agenda/activities/:id', ({ ctx, params }) => toResponse(load(ctx, params.id))),
  route(
    'POST',
    '/api/agenda/activities',
    ({ ctx, body }) => {
      ensureCategories(ctx)
      return saveActivity(ctx, ctx.uuid(), readActivity(ctx, body, null), true)
    },
    201,
  ),
  // Editar una actividad repetida cambia toda la serie; los estados guardados siguen ligados a su fecha.
  route('PUT', '/api/agenda/activities/:id', ({ ctx, params, body }) => {
    const activity = load(ctx, params.id)
    return saveActivity(ctx, activity.id, readActivity(ctx, body, activity), false)
  }),
  route('DELETE', '/api/agenda/activities/:id', ({ ctx, params }) => {
    ctx.db.run('delete from activity where id = ?', [load(ctx, params.id).id])
  }),
  route('PUT', '/api/agenda/activities/:id/occurrences/:date', setStatus),
  // Las categorías iniciales se crean en la primera consulta, que por eso va dentro de una transacción.
  route('GET', '/api/agenda/categories', ({ ctx }) => {
    ctx.db.transaction(() => ensureCategories(ctx))
    const used = usedCategoryIds(ctx)
    return ctx.db
      .all<CategoryRow>('select * from activity_category')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => categoryResponse(c, used))
  }),
  route(
    'POST',
    '/api/agenda/categories',
    ({ ctx, body }) => {
      ensureCategories(ctx)
      const input = readCategory(ctx, body, null)
      const id = ctx.uuid()
      ctx.db.run('insert into activity_category (id, name, color, archived, created_at) values (?, ?, ?, 0, ?)', [
        id,
        input.name,
        input.color,
        ctx.now().toISOString(),
      ])
      return categoryResponse(loadCategory(ctx, id), new Set())
    },
    201,
  ),
  route('PUT', '/api/agenda/categories/:id', ({ ctx, params, body }) => {
    const category = loadCategory(ctx, params.id)
    const input = readCategory(ctx, body, category.id)
    ctx.db.run('update activity_category set name = ?, color = ?, archived = ? where id = ?', [
      input.name,
      input.color,
      input.archived ? 1 : 0,
      category.id,
    ])
    return categoryResponse(loadCategory(ctx, category.id), usedCategoryIds(ctx))
  }),
  // Una categoría con actividades no se borra (se quedarían sin categoría); se puede archivar.
  route('DELETE', '/api/agenda/categories/:id', ({ ctx, params }) => {
    const category = loadCategory(ctx, params.id)
    if (usedCategoryIds(ctx).has(category.id)) throw conflict('activity-category-in-use')
    ctx.db.run('delete from activity_category where id = ?', [category.id])
  }),
]
