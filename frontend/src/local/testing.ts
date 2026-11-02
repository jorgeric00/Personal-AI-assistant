import initSqlJs from 'sql.js'

import { LocalApi } from './api'
import { LocalError } from './errors'
import { memoryStorage } from './storage'

/** API local en memoria con un reloj que se puede mover, para las pruebas. */
export async function openTestApi(start = '2026-10-14T08:00:00Z', storage = memoryStorage()) {
  const sql = await initSqlJs()
  let now = new Date(start)
  let counter = 0
  const api = await LocalApi.open({
    sql,
    storage,
    now: () => now,
    timeZone: 'Europe/Madrid',
    uuid: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  })
  return {
    api,
    storage,
    setNow: (instant: string) => {
      now = new Date(instant)
    },
    get: <T = any>(path: string) => api.request('GET', path).then((r) => r.body as T),
    send: <T = any>(method: string, path: string, body?: unknown) =>
      api.request(method, path, body).then((r) => r.body as T),
  }
}

/** Espera a que la petición falle y devuelve el error de la API local. */
export async function failure(promise: Promise<unknown>): Promise<LocalError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof LocalError) return error
    throw error
  }
  throw new Error('no ha fallado')
}
