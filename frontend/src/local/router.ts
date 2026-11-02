import type { LocalDb } from './db'
import { LocalError } from './errors'

/** Lo que necesita cada operación: la base de datos y el reloj (inyectable en las pruebas). */
export interface LocalContext {
  db: LocalDb
  now(): Date
  timeZone: string
  /** Fecha de hoy en la zona horaria del dispositivo. */
  today(): string
  uuid(): string
}

export interface LocalRequest {
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
  ctx: LocalContext
}

type Handler = (request: LocalRequest) => unknown

interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: Handler
  status: number
}

export interface LocalResponse {
  status: number
  body: unknown
}

/** Declara una operación con la misma ruta que la API del servidor; :nombre captura un segmento. */
export function route(method: string, path: string, handler: Handler, status = 200): Route {
  const keys: string[] = []
  const source = path.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
    keys.push(key)
    return '([^/]+)'
  })
  return { method, pattern: new RegExp(`^${source}$`), keys, handler, status }
}

export class LocalRouter {
  private readonly routes: Route[]

  constructor(routes: Route[]) {
    this.routes = routes
  }

  /** Resuelve una petición. Las que cambian datos van en una transacción: o se guarda todo o nada. */
  handle(method: string, url: string, body: unknown, ctx: LocalContext): LocalResponse {
    const [path, search = ''] = url.split('?')
    for (const candidate of this.routes) {
      if (candidate.method !== method) continue
      const match = candidate.pattern.exec(path)
      if (!match) continue
      const params = Object.fromEntries(candidate.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]))
      const request = { params, query: new URLSearchParams(search), body: body ?? {}, ctx }
      const result =
        method === 'GET' ? candidate.handler(request) : ctx.db.transaction(() => candidate.handler(request))
      return result === undefined ? { status: 204, body: undefined } : { status: candidate.status, body: result }
    }
    throw new LocalError(501, 'not-available')
  }
}
