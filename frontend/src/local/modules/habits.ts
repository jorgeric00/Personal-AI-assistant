import { daysBetween, isIsoDate, type WeekdayName, WEEKDAY_NAMES } from '../dates'
import { LocalError, notFound, Validator } from '../errors'
import { route, type LocalContext, type LocalRequest } from '../router'
import { asBody, int, isBlank, oneOf, text } from '../values'

/** Hábitos y los días cumplidos: la misma lógica que HabitService del servidor. */

const FREQUENCIES = ['DAILY', 'WEEKLY'] as const
/** Rango máximo de marcas por consulta (unas 17 semanas de historial). */
const MAX_RANGE_DAYS = 120

interface HabitRow {
  id: string
  name: string
  color: string
  frequency: 'DAILY' | 'WEEKLY'
  weekdays: string | null
  times_per_week: number | null
  start_date: string
  archived: number
}

function toResponse(habit: HabitRow, checks: string[]) {
  return {
    id: habit.id,
    name: habit.name,
    color: habit.color,
    frequency: habit.frequency,
    weekdays: habit.weekdays ? habit.weekdays.split(',') : [],
    timesPerWeek: habit.times_per_week,
    startDate: habit.start_date,
    archived: habit.archived === 1,
    // Los avisos de hábitos todavía no funcionan en la app.
    reminderTime: null,
    checks,
  }
}

function load(ctx: LocalContext, id: string): HabitRow {
  const habit = ctx.db.get<HabitRow>('select * from habit where id = ?', [id])
  if (!habit) throw notFound()
  return habit
}

function list({ ctx, query }: LocalRequest) {
  const from = query.get('from')
  const to = query.get('to')
  new Validator()
    .add(!isIsoDate(from), 'from', 'habits.range.invalid')
    .add(!isIsoDate(to), 'to', 'habits.range.invalid')
    .throwIfAny()
  new Validator()
    .add(to! < from! || daysBetween(from!, to!) >= MAX_RANGE_DAYS, 'to', 'habits.range.invalid')
    .throwIfAny()
  const checks = ctx.db.all<{ habit_id: string; date: string }>(
    'select habit_id, date from habit_check where date between ? and ? order by date',
    [from, to],
  )
  return ctx.db
    .all<HabitRow>('select * from habit order by created_at, rowid')
    .map((habit) => toResponse(habit, checks.filter((c) => c.habit_id === habit.id).map((c) => c.date)))
}

interface HabitInput {
  name: string
  color: string
  frequency: 'DAILY' | 'WEEKLY'
  /** Solo DAILY; null = todos los días. */
  weekdays: string | null
  timesPerWeek: number | null
  archived: boolean
}

/** Validaciones de HabitRequest y de HabitService.apply. */
function readHabit(ctx: LocalContext, raw: unknown, excludeId: string | null): HabitInput {
  const body = asBody(raw)
  const name = text(body, 'name')
  const color = text(body, 'color')
  const frequency = oneOf(body, 'frequency', FREQUENCIES)
  const times = int(body, 'timesPerWeek')
  new Validator()
    .add(isBlank(name), 'name', 'habits.name.required')
    .add((name ?? '').length > 80, 'name', 'habits.name.too-long')
    .add(color === null || !/^#[0-9a-fA-F]{6}$/.test(color), 'color', 'habits.color.invalid')
    .add(frequency === null, 'frequency', 'habits.frequency.required')
    .add(times !== null && (times < 1 || times > 7), 'timesPerWeek', 'habits.times.invalid')
    .throwIfAny()
  const trimmed = name!.trim()
  const taken = ctx.db
    .all<{ id: string; name: string }>('select id, name from habit')
    .some((h) => h.id !== excludeId && h.name.toLowerCase() === trimmed.toLowerCase())
  new Validator()
    .add(taken, 'name', 'habits.name.duplicate')
    .add(frequency === 'WEEKLY' && times === null, 'timesPerWeek', 'habits.times.invalid')
    .throwIfAny()
  const days = Array.isArray(body.weekdays)
    ? WEEKDAY_NAMES.filter((day) => (body.weekdays as unknown[]).includes(day))
    : ([] as WeekdayName[])
  // DAILY guarda los días (vacío o los 7 = todos) y WEEKLY las veces por semana; lo que no aplica se descarta.
  const daily = frequency === 'DAILY'
  return {
    name: trimmed,
    color: color!.toLowerCase(),
    frequency: frequency!,
    weekdays: !daily || days.length === 0 || days.length === 7 ? null : days.join(','),
    timesPerWeek: daily ? null : times,
    archived: body.archived === true,
  }
}

function values(input: HabitInput) {
  return [input.name, input.color, input.frequency, input.weekdays, input.timesPerWeek, input.archived ? 1 : 0]
}

/** Marca un día como cumplido. Repetir la marca no hace nada. */
function check({ ctx, params }: LocalRequest) {
  const habit = load(ctx, params.id)
  const date = params.date
  if (!isIsoDate(date)) throw new LocalError(400, 'validation')
  new Validator().add(date > ctx.today(), 'date', 'habits.date.future').throwIfAny()
  ctx.db.run('insert or ignore into habit_check (habit_id, date, created_at) values (?, ?, ?)', [
    habit.id,
    date,
    ctx.now().toISOString(),
  ])
}

export const habitRoutes = [
  route('GET', '/api/habits', list),
  route(
    'POST',
    '/api/habits',
    ({ ctx, body }) => {
      const input = readHabit(ctx, body, null)
      const id = ctx.uuid()
      const now = ctx.now().toISOString()
      ctx.db.run(
        `insert into habit (name, color, frequency, weekdays, times_per_week, archived, id, start_date, created_at,
           updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...values(input), id, ctx.today(), now, now],
      )
      return toResponse(load(ctx, id), [])
    },
    201,
  ),
  route('PUT', '/api/habits/:id', ({ ctx, params, body }) => {
    const habit = load(ctx, params.id)
    const input = readHabit(ctx, body, habit.id)
    ctx.db.run(
      `update habit set name = ?, color = ?, frequency = ?, weekdays = ?, times_per_week = ?, archived = ?,
         updated_at = ? where id = ?`,
      [...values(input), ctx.now().toISOString(), habit.id],
    )
    return toResponse(load(ctx, habit.id), [])
  }),
  route('DELETE', '/api/habits/:id', ({ ctx, params }) => {
    ctx.db.run('delete from habit where id = ?', [load(ctx, params.id).id])
  }),
  route('PUT', '/api/habits/:id/checks/:date', check),
  route('DELETE', '/api/habits/:id/checks/:date', ({ ctx, params }) => {
    const habit = load(ctx, params.id)
    ctx.db.run('delete from habit_check where habit_id = ? and date = ?', [habit.id, params.date])
  }),
]
