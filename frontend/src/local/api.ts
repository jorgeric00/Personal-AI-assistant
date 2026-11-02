import type { SqlJsStatic } from 'sql.js'

import { todayIn } from './dates'
import { LocalDb } from './db'
import { accountRoutes } from './modules/account'
import { habitRoutes } from './modules/habits'
import { noteRoutes, purgeExpiredTrash } from './modules/notes'
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

const router = new LocalRouter([...accountRoutes, ...taskRoutes, ...noteRoutes, ...habitRoutes])

/**
 * API local: responde a las mismas rutas que el servidor usando la base de datos del móvil. Las peticiones se atienden
 * de una en una y cada cambio se guarda antes de responder, así que lo que la app da por guardado ya está guardado.
 */
export class LocalApi {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly ctx: LocalContext
  private readonly storage: DatabaseStorage

  private constructor(ctx: LocalContext, storage: DatabaseStorage) {
    this.ctx = ctx
    this.storage = storage
  }

  static async open(options: LocalApiOptions): Promise<LocalApi> {
    const saved = await options.storage.load()
    const db = new LocalDb(new options.sql.Database(saved ?? undefined))
    const now = options.now ?? (() => new Date())
    const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const ctx: LocalContext = {
      db,
      now,
      timeZone,
      today: () => todayIn(timeZone, now()),
      uuid: options.uuid ?? (() => crypto.randomUUID()),
    }
    const api = new LocalApi(ctx, options.storage)
    // Mantenimiento que en el servidor hacen tareas programadas.
    db.transaction(() => purgeExpiredTrash(ctx))
    // Guarda ya la base recién creada o migrada.
    await options.storage.save(db.export())
    return api
  }

  request(method: string, path: string, body?: unknown): Promise<LocalResponse> {
    const run = async () => {
      const response = this.handle(method, path, body)
      if (method !== 'GET') await this.storage.save(this.ctx.db.export())
      return response
    }
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => undefined)
    return result
  }

  private handle(method: string, path: string, body: unknown): LocalResponse {
    // Copia del cuerpo, como si hubiera viajado en JSON.
    const json = body === undefined ? undefined : JSON.parse(JSON.stringify(body))
    return router.handle(method, path, json, this.ctx)
  }
}
