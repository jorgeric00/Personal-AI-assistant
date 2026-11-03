import type { SqlJsStatic } from 'sql.js'

import { todayIn } from './dates'
import { LocalDb } from './db'
import { LocalError } from './errors'
import { MIGRATIONS } from './migrations'
import { accountRoutes } from './modules/account'
import { agendaRoutes } from './modules/agenda'
import { habitRoutes } from './modules/habits'
import { noteRoutes, purgeExpiredTrash } from './modules/notes'
import { upcomingReminders, type ScheduledReminder } from './modules/reminders'
import { taskRoutes } from './modules/tasks'
import { LocalRouter, type LocalContext, type LocalResponse } from './router'
import type { DatabaseStorage } from './storage'

export interface LocalApiOptions {
  sql: SqlJsStatic
  storage: DatabaseStorage
  now?: () => Date
  timeZone?: string
  uuid?: () => string
}

const router = new LocalRouter([...accountRoutes, ...taskRoutes, ...noteRoutes, ...habitRoutes, ...agendaRoutes])

/**
 * API local: responde a las mismas rutas que el servidor usando la base de datos del móvil. Las peticiones se atienden
 * de una en una y cada cambio se guarda antes de responder, así que lo que la app da por guardado ya está guardado.
 */
export class LocalApi {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly ctx: LocalContext
  private readonly storage: DatabaseStorage
  private readonly sql: SqlJsStatic

  private constructor(ctx: LocalContext, storage: DatabaseStorage, sql: SqlJsStatic) {
    this.ctx = ctx
    this.storage = storage
    this.sql = sql
  }

  static async open(options: LocalApiOptions): Promise<LocalApi> {
    const saved = await options.storage.load()
    const db = new LocalDb(new options.sql.Database(saved ?? undefined))
    markAsLifeos(db)
    const now = options.now ?? (() => new Date())
    const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const ctx: LocalContext = {
      db,
      now,
      timeZone,
      today: () => todayIn(timeZone, now()),
      uuid: options.uuid ?? (() => crypto.randomUUID()),
    }
    const api = new LocalApi(ctx, options.storage, options.sql)
    // Mantenimiento que en el servidor hacen tareas programadas.
    db.transaction(() => purgeExpiredTrash(ctx))
    // Guarda ya la base recién creada o migrada.
    await options.storage.save(db.export())
    return api
  }

  request(method: string, path: string, body?: unknown): Promise<LocalResponse> {
    const run = async () => {
      const writes = this.ctx.db.writeCount
      const response = this.handle(method, path, body)
      // Algunas consultas también escriben (las categorías iniciales de la agenda, por ejemplo).
      if (method !== 'GET' || this.ctx.db.writeCount !== writes) await this.storage.save(this.ctx.db.export())
      return response
    }
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => undefined)
    return result
  }

  /** Copia de seguridad: la base de datos completa, tal como está guardada. */
  exportBackup(): Promise<Uint8Array> {
    return this.enqueue(async () => this.ctx.db.export())
  }

  /**
   * Sustituye todos los datos por los de una copia. Antes comprueba que sea una copia de LifeOS sana y que esta versión
   * de la app la entienda; si no, no toca nada.
   */
  restoreBackup(bytes: Uint8Array): Promise<void> {
    return this.enqueue(async () => {
      const db = openBackup(this.sql, bytes)
      this.ctx.db = db
      await this.storage.save(db.export())
    })
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work)
    this.queue = result.catch(() => undefined)
    return result
  }

  /** Avisos que hay que programar en el móvil, calculados con los datos guardados. */
  reminders(): Promise<ScheduledReminder[]> {
    return this.enqueue(async () => upcomingReminders(this.ctx))
  }

  private handle(method: string, path: string, body: unknown): LocalResponse {
    // Copia del cuerpo, como si hubiera viajado en JSON.
    const json = body === undefined ? undefined : JSON.parse(JSON.stringify(body))
    return router.handle(method, path, json, this.ctx)
  }
}

/** Marca la base como de LifeOS, para reconocer sus copias. */
function markAsLifeos(db: LocalDb) {
  db.run("insert or ignore into app_setting (key, value) values ('app', 'lifeos')")
}

const SQLITE_HEADER = 'SQLite format 3\u0000'

function openBackup(sql: SqlJsStatic, bytes: Uint8Array): LocalDb {
  const header = new TextDecoder().decode(bytes.slice(0, SQLITE_HEADER.length))
  if (header !== SQLITE_HEADER) throw new LocalError(400, 'backup-invalid')
  let raw
  try {
    raw = new sql.Database(bytes)
    const ok = raw.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] === 'ok'
    const app = raw.exec("select value from app_setting where key = 'app'")[0]?.values[0]?.[0]
    if (!ok || app !== 'lifeos') throw new LocalError(400, 'backup-invalid')
  } catch (error) {
    raw?.close()
    throw error instanceof LocalError ? error : new LocalError(400, 'backup-invalid')
  }
  const version = Number(raw.exec('PRAGMA user_version')[0]?.values[0]?.[0] ?? 0)
  if (version > MIGRATIONS.length) {
    raw.close()
    throw new LocalError(400, 'backup-newer')
  }
  // Una copia de una versión anterior se pone al día con las migraciones que le falten.
  return new LocalDb(raw)
}
