import { daysBetween, isIsoDate, isTime, normalizeTime, type WeekdayName, WEEKDAY_NAMES } from '../dates'
import { conflict, notFound, Validator } from '../errors'
import { Recurrence, type Frequency } from '../recurrence'
import { route, type LocalContext, type LocalRequest } from '../router'
import { asBody, blankToNull, int, isBlank, oneOf, text, type Body } from '../values'

/** Tareas y recordatorios: la misma lógica que TaskService y TaskCategoryService del servidor. */

const KINDS = ['TASK', 'REMINDER'] as const
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const
const VIEWS = ['TODAY', 'UPCOMING', 'ALL', 'DONE'] as const

const MAX_CALENDAR_DAYS = 62
const DONE_LIMIT = 200

interface TaskRow {
  id: string
  kind: string
  title: string
  description: string | null
  due_date: string | null
  due_time: string | null
  deadline: string | null
  priority: string
  category_id: string | null
  category_name: string | null
  category_color: string | null
  status: string
  recurrence_frequency: Frequency | null
  recurrence_interval: number | null
  recurrence_weekdays: string | null
  recurrence_anchor: string | null
  recurrence_until: string | null
  reminder_minutes_before: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

const SELECT = `
  select t.*, c.name as category_name, c.color as category_color
  from task t left join task_category c on c.id = t.category_id`

// HIGH primero (en el servidor se ordena por el texto de la prioridad).
const OPEN_ORDER = `
  order by t.due_date is null, t.due_date, t.due_time is null, t.due_time,
           case t.priority when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end, t.created_at`

function recurrenceOf(row: TaskRow): Recurrence | null {
  if (!row.recurrence_frequency) return null
  return new Recurrence(
    row.recurrence_frequency,
    row.recurrence_interval ?? 1,
    Recurrence.parseWeekdays(row.recurrence_weekdays),
    row.recurrence_anchor!,
    row.recurrence_until,
  )
}

function category(row: { category_id: string | null; category_name: string | null; category_color: string | null }) {
  return row.category_id ? { id: row.category_id, name: row.category_name, color: row.category_color } : null
}

function toResponse(row: TaskRow, today: string) {
  const recurrence = recurrenceOf(row)
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    dueTime: row.due_time,
    deadline: row.deadline,
    priority: row.priority,
    category: category(row),
    status: row.status,
    recurrence: recurrence && {
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      weekdays: recurrence.weekdays,
      until: recurrence.until,
    },
    reminderMinutesBefore: row.reminder_minutes_before,
    overdue: row.status !== 'DONE' && row.due_date !== null && row.due_date < today,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function load(ctx: LocalContext, id: string): TaskRow {
  const row = ctx.db.get<TaskRow>(`${SELECT} where t.id = ?`, [id])
  if (!row) throw notFound()
  return row
}

function reload(ctx: LocalContext, id: string) {
  return toResponse(load(ctx, id), ctx.today())
}

function findOpen(ctx: LocalContext): TaskRow[] {
  return ctx.db.all<TaskRow>(`${SELECT} where t.status <> 'DONE' ${OPEN_ORDER}`)
}

function list({ ctx, query }: LocalRequest) {
  const today = ctx.today()
  const view = (VIEWS as readonly string[]).includes(query.get('view') ?? '') ? query.get('view') : 'ALL'
  const rows =
    view === 'DONE'
      ? ctx.db.all<TaskRow>(`${SELECT} where t.status = 'DONE' order by t.completed_at desc limit ${DONE_LIMIT}`)
      : findOpen(ctx)
  const categoryId = query.get('categoryId')
  const priority = query.get('priority')
  const kind = query.get('kind')
  const status = query.get('status')
  return rows
    .filter((t) => {
      if (view === 'TODAY') return t.due_date !== null && t.due_date <= today
      if (view === 'UPCOMING') return t.due_date !== null && t.due_date > today
      return true
    })
    .filter((t) => !categoryId || t.category_id === categoryId)
    .filter((t) => !priority || t.priority === priority)
    .filter((t) => !kind || t.kind === kind)
    .filter((t) => !status || t.status === status)
    .map((t) => toResponse(t, today))
}

interface TaskInput {
  kind: string
  title: string
  description: string | null
  dueDate: string | null
  dueTime: string | null
  deadline: string | null
  priority: string
  categoryId: string | null
  recurrence: { frequency: Frequency; interval: number; weekdays: WeekdayName[]; until: string | null } | null
  reminderMinutesBefore: number | null
}

/** Validaciones de TaskRequest (anotaciones del DTO en el servidor). */
function readTask(raw: unknown): TaskInput {
  const body = asBody(raw)
  const kind = oneOf(body, 'kind', KINDS)
  const title = text(body, 'title')
  const description = text(body, 'description')
  const priority = oneOf(body, 'priority', PRIORITIES)
  const reminder = int(body, 'reminderMinutesBefore')
  const rawRecurrence = body.recurrence ? asBody(body.recurrence) : null
  const frequency = rawRecurrence ? oneOf(rawRecurrence, 'frequency', FREQUENCIES) : null
  const interval = rawRecurrence ? int(rawRecurrence, 'interval') : null
  new Validator()
    .add(kind === null, 'kind', 'task.kind.required')
    .add(isBlank(title), 'title', 'task.title.required')
    .add((title ?? '').length > 200, 'title', 'task.title.too-long')
    .add((description ?? '').length > 5000, 'description', 'task.description.too-long')
    .add(priority === null, 'priority', 'task.priority.required')
    .add(rawRecurrence !== null && frequency === null, 'recurrence.frequency', 'task.recurrence.frequency.required')
    .add(
      rawRecurrence !== null && (interval === null || interval < 1 || interval > 365),
      'recurrence.interval',
      'task.recurrence.interval.invalid',
    )
    .add(reminder !== null && (reminder < 0 || reminder > 10080), 'reminderMinutesBefore', 'task.notification.invalid')
    .throwIfAny()
  const weekdays = Array.isArray(rawRecurrence?.weekdays)
    ? (rawRecurrence.weekdays as unknown[]).filter((d): d is WeekdayName =>
        (WEEKDAY_NAMES as readonly unknown[]).includes(d),
      )
    : []
  const until = rawRecurrence ? text(rawRecurrence, 'until') : null
  return {
    kind: kind!,
    title: title!,
    description,
    dueDate: dateOrNull(body, 'dueDate'),
    dueTime: isTime(body.dueTime) ? normalizeTime(body.dueTime) : null,
    deadline: dateOrNull(body, 'deadline'),
    priority: priority!,
    categoryId: text(body, 'categoryId'),
    recurrence: rawRecurrence
      ? { frequency: frequency!, interval: interval!, weekdays, until: isIsoDate(until) ? until : null }
      : null,
    reminderMinutesBefore: reminder,
  }
}

function dateOrNull(body: Body, field: string): string | null {
  const value = body[field]
  return isIsoDate(value) ? value : null
}

/** Guarda los datos editables, con las mismas reglas que TaskService.apply. */
function save(ctx: LocalContext, id: string, current: TaskRow | null, input: TaskInput) {
  const errors = new Validator()
  if (input.categoryId !== null) {
    const exists = ctx.db.get('select 1 from task_category where id = ?', [input.categoryId])
    errors.add(!exists, 'categoryId', 'task.category.not-found')
  }
  const r = input.recurrence
  errors
    .add(input.dueTime !== null && input.dueDate === null, 'dueTime', 'task.due-time.requires-date')
    .add(
      input.kind === 'REMINDER' && (input.dueDate === null || input.dueTime === null),
      'dueTime',
      'task.reminder.requires-datetime',
    )
    .add(
      input.reminderMinutesBefore !== null && input.dueTime === null,
      'reminderMinutesBefore',
      'task.notification.requires-time',
    )
    .add(r !== null && input.dueDate === null, 'recurrence', 'task.recurrence.requires-date')
    .add(r !== null && r.weekdays.length > 0 && r.frequency !== 'WEEKLY', 'recurrence', 'task.recurrence.weekdays-only-weekly')
    .add(
      r !== null && r.until !== null && input.dueDate !== null && r.until < input.dueDate,
      'recurrence',
      'task.recurrence.until-before-start',
    )
    .throwIfAny()

  let dueDate = input.dueDate
  let recurrence: Recurrence | null = null
  if (r !== null && dueDate !== null) {
    const previous = current ? recurrenceOf(current) : null
    const sameSchedule =
      previous !== null &&
      previous.frequency === r.frequency &&
      previous.interval === r.interval &&
      previous.weekdays.join() === new Recurrence(r.frequency, 1, r.weekdays, dueDate, null).weekdays.join() &&
      current!.due_date === dueDate
    // Si no cambia la regla ni la fecha, se conserva el ancla original (importante para «cada mes el día 31»).
    const anchor = sameSchedule ? previous.anchor : dueDate
    recurrence = new Recurrence(r.frequency, r.interval, r.weekdays, anchor, r.until)
    dueDate = recurrence.firstOnOrAfter(dueDate)
    new Validator().add(dueDate === null, 'recurrence', 'task.recurrence.until-before-start').throwIfAny()
  }

  const now = ctx.now().toISOString()
  const values = [
    input.kind,
    input.title.trim(),
    blankToNull(input.description),
    dueDate,
    input.dueTime,
    input.deadline,
    input.priority,
    input.categoryId,
    recurrence?.frequency ?? null,
    recurrence?.interval ?? null,
    recurrence?.weekdaysAsString() ?? null,
    recurrence?.anchor ?? null,
    recurrence?.until ?? null,
    input.reminderMinutesBefore,
    now,
  ]
  if (current) {
    ctx.db.run(
      `update task set kind = ?, title = ?, description = ?, due_date = ?, due_time = ?, deadline = ?, priority = ?,
         category_id = ?, recurrence_frequency = ?, recurrence_interval = ?, recurrence_weekdays = ?,
         recurrence_anchor = ?, recurrence_until = ?, reminder_minutes_before = ?, updated_at = ?
       where id = ?`,
      [...values, id],
    )
  } else {
    ctx.db.run(
      `insert into task (kind, title, description, due_date, due_time, deadline, priority, category_id,
         recurrence_frequency, recurrence_interval, recurrence_weekdays, recurrence_anchor, recurrence_until,
         reminder_minutes_before, updated_at, id, status, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [...values, id, now],
    )
  }
  return reload(ctx, id)
}

function occurrenceDate(raw: unknown): string | null {
  const value = asBody(raw).occurrenceDate
  return isIsoDate(value) ? value : null
}

/** Completa la aparición indicada; en una recurrente pasa a la siguiente y salta las atrasadas hasta hoy. */
function complete({ ctx, params, body }: LocalRequest) {
  const task = load(ctx, params.id)
  const date = occurrenceDate(body)
  if (task.status === 'DONE' || task.due_date !== date) throw conflict('task-occurrence-mismatch')
  const now = ctx.now().toISOString()
  const recurrence = recurrenceOf(task)
  if (!recurrence) {
    ctx.db.run(`update task set status = 'DONE', completed_at = ?, updated_at = ? where id = ?`, [now, now, task.id])
    return reload(ctx, task.id)
  }
  ctx.db.run('insert into task_completion (task_id, occurrence_date, completed_at) values (?, ?, ?)', [
    task.id,
    date,
    now,
  ])
  const today = ctx.today()
  let next = recurrence.nextAfter(date!)
  if (next !== null && next < today) next = recurrence.firstOnOrAfter(today)
  if (next === null) {
    ctx.db.run(`update task set status = 'DONE', completed_at = ?, updated_at = ? where id = ?`, [now, now, task.id])
  } else {
    ctx.db.run(`update task set due_date = ?, status = 'PENDING', updated_at = ? where id = ?`, [next, now, task.id])
  }
  return reload(ctx, task.id)
}

/** Deshace una compleción (por ejemplo desde el aviso «Deshacer»). */
function uncomplete({ ctx, params, body }: LocalRequest) {
  const task = load(ctx, params.id)
  const date = occurrenceDate(body)
  const now = ctx.now().toISOString()
  let reopenOn = task.due_date
  if (task.recurrence_frequency) {
    const done = ctx.db.get('select 1 from task_completion where task_id = ? and occurrence_date = ?', [task.id, date])
    if (!done) throw conflict('task-occurrence-mismatch')
    ctx.db.run('delete from task_completion where task_id = ? and occurrence_date = ?', [task.id, date])
    reopenOn = date
  } else if (task.status !== 'DONE') {
    throw conflict('task-occurrence-mismatch')
  }
  ctx.db.run(
    `update task set status = 'PENDING', due_date = ?, completed_at = null, updated_at = ? where id = ?`,
    [reopenOn, now, task.id],
  )
  return reload(ctx, task.id)
}

function postpone({ ctx, params, body }: LocalRequest) {
  const task = load(ctx, params.id)
  const value = asBody(body).date
  const date = isIsoDate(value) ? value : null
  new Validator().add(date === null, 'date', 'task.postpone.date.required').throwIfAny()
  if (task.status === 'DONE') throw conflict('task-already-done')
  new Validator().add(date! < ctx.today(), 'date', 'task.postpone.past').throwIfAny()
  ctx.db.run(`update task set due_date = ?, status = 'POSTPONED', updated_at = ? where id = ?`, [
    date,
    ctx.now().toISOString(),
    task.id,
  ])
  return reload(ctx, task.id)
}

interface CalendarEntry {
  taskId: string
  date: string
  time: string | null
  title: string
  kind: string
  priority: string
  category: ReturnType<typeof category>
  done: boolean
  recurring: boolean
}

function entry(task: TaskRow, date: string, done: boolean): CalendarEntry {
  return {
    taskId: task.id,
    date,
    time: task.due_time,
    title: task.title,
    kind: task.kind,
    priority: task.priority,
    category: category(task),
    done,
    recurring: task.recurrence_frequency !== null,
  }
}

/** Apariciones entre dos fechas, incluidas las futuras de las tareas recurrentes y las ya completadas. */
function calendar({ ctx, query }: LocalRequest) {
  const from = query.get('from')
  const to = query.get('to')
  new Validator()
    .add(!isIsoDate(from), 'from', 'task.calendar.invalid-range')
    .add(!isIsoDate(to), 'to', 'task.calendar.invalid-range')
    .throwIfAny()
  new Validator()
    .add(to! < from!, 'to', 'task.calendar.invalid-range')
    .add(daysBetween(from!, to!) > MAX_CALENDAR_DAYS, 'to', 'task.calendar.range-too-long')
    .throwIfAny()

  const entries: CalendarEntry[] = []
  for (const task of findOpen(ctx)) {
    if (task.due_date === null || task.due_date > to!) continue
    if (task.due_date >= from!) entries.push(entry(task, task.due_date, false))
    const recurrence = recurrenceOf(task)
    if (recurrence) {
      const start = new Date(`${task.due_date}T00:00:00Z`)
      start.setUTCDate(start.getUTCDate() + 1)
      recurrence
        .occurrencesBetween(start.toISOString().slice(0, 10), from!, to!)
        .forEach((date) => entries.push(entry(task, date, false)))
    }
  }
  const doneOnce = ctx.db.all<TaskRow>(
    `${SELECT} where t.status = 'DONE' and t.recurrence_frequency is null and t.due_date between ? and ?`,
    [from, to],
  )
  doneOnce.forEach((task) => entries.push(entry(task, task.due_date!, true)))
  const completions = ctx.db.all<TaskRow & { occurrence_date: string }>(
    `select t.*, c.name as category_name, c.color as category_color, tc.occurrence_date
     from task_completion tc join task t on t.id = tc.task_id left join task_category c on c.id = t.category_id
     where tc.occurrence_date between ? and ?`,
    [from, to],
  )
  completions.forEach((row) => entries.push(entry(row, row.occurrence_date, true)))
  return entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '￿').localeCompare(b.time ?? '￿') ||
      a.title.localeCompare(b.title),
  )
}

interface CategoryRow {
  id: string
  name: string
  color: string
}

function readCategory(raw: unknown) {
  const body = asBody(raw)
  const name = text(body, 'name')
  const color = text(body, 'color')
  new Validator()
    .add(isBlank(name), 'name', 'task.category.name.required')
    .add((name ?? '').length > 50, 'name', 'task.category.name.too-long')
    .add(color === null || !/^#[0-9a-fA-F]{6}$/.test(color), 'color', 'task.category.color.invalid')
    .throwIfAny()
  return { name: name!.trim(), color: color! }
}

function checkUniqueCategory(ctx: LocalContext, name: string, excludeId: string | null) {
  const taken = ctx.db
    .all<CategoryRow>('select id, name from task_category')
    .some((c) => c.id !== excludeId && c.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  new Validator().add(taken, 'name', 'task.category.name.duplicate').throwIfAny()
}

function loadCategory(ctx: LocalContext, id: string): CategoryRow {
  const row = ctx.db.get<CategoryRow>('select id, name, color from task_category where id = ?', [id])
  if (!row) throw notFound()
  return row
}

export const taskRoutes = [
  route('GET', '/api/tasks', list),
  route('GET', '/api/tasks/calendar', calendar),
  route('GET', '/api/tasks/:id', ({ ctx, params }) => reload(ctx, params.id)),
  route('POST', '/api/tasks', ({ ctx, body }) => save(ctx, ctx.uuid(), null, readTask(body)), 201),
  route('PUT', '/api/tasks/:id', ({ ctx, params, body }) => save(ctx, params.id, load(ctx, params.id), readTask(body))),
  route('DELETE', '/api/tasks/:id', ({ ctx, params }) => {
    ctx.db.run('delete from task where id = ?', [load(ctx, params.id).id])
  }),
  route('POST', '/api/tasks/:id/complete', complete),
  route('POST', '/api/tasks/:id/uncomplete', uncomplete),
  route('POST', '/api/tasks/:id/postpone', postpone),
  route('GET', '/api/task-categories', ({ ctx }) =>
    ctx.db
      .all<CategoryRow>('select id, name, color from task_category')
      .sort((a, b) => a.name.localeCompare(b.name)),
  ),
  route(
    'POST',
    '/api/task-categories',
    ({ ctx, body }) => {
      const input = readCategory(body)
      checkUniqueCategory(ctx, input.name, null)
      const id = ctx.uuid()
      ctx.db.run('insert into task_category (id, name, color, created_at) values (?, ?, ?, ?)', [
        id,
        input.name,
        input.color,
        ctx.now().toISOString(),
      ])
      return loadCategory(ctx, id)
    },
    201,
  ),
  route('PUT', '/api/task-categories/:id', ({ ctx, params, body }) => {
    const category = loadCategory(ctx, params.id)
    const input = readCategory(body)
    checkUniqueCategory(ctx, input.name, category.id)
    ctx.db.run('update task_category set name = ?, color = ? where id = ?', [input.name, input.color, category.id])
    return loadCategory(ctx, category.id)
  }),
  // Las tareas de la categoría se conservan sin categoría (ON DELETE SET NULL).
  route('DELETE', '/api/task-categories/:id', ({ ctx, params }) => {
    ctx.db.run('delete from task_category where id = ?', [loadCategory(ctx, params.id).id])
  }),
]
