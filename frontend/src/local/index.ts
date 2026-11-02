import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

import i18n from '../i18n'
import { LocalApi } from './api'
import { LocalError } from './errors'
import { MESSAGES } from './messages'
import { indexedDbStorage } from './storage'

/** Punto de entrada de la API local en la app. Se carga aparte para que la web no descargue SQLite. */

let api: Promise<LocalApi> | null = null

function openApi(): Promise<LocalApi> {
  api ??= (async () => {
    // Pide que el sistema no borre los datos de la app para liberar espacio.
    await navigator.storage?.persist?.().catch(() => false)
    const sql = await initSqlJs({ locateFile: () => wasmUrl })
    return LocalApi.open({ sql, storage: indexedDbStorage() })
  })()
  return api
}

export interface LocalProblem {
  status: number
  title: string
  detail: string
  fieldErrors: Record<string, string>
}

export function localMessage(key: string): string {
  const language = i18n.language?.startsWith('en') ? 'en' : 'es'
  return MESSAGES[language][key] ?? MESSAGES.es[key] ?? key
}

/** Traduce un error de la API local al mismo formato que los errores del servidor. */
export function toProblem(error: unknown): LocalProblem {
  if (error instanceof LocalError) {
    return {
      status: error.status,
      title: localMessage(`error.${error.code}.title`),
      detail: localMessage(`error.${error.code}.detail`),
      fieldErrors: Object.fromEntries(Object.entries(error.fieldErrors).map(([f, k]) => [f, localMessage(k)])),
    }
  }
  console.error(error)
  return {
    status: 500,
    title: localMessage('error.internal.title'),
    detail: localMessage('error.internal.detail'),
    fieldErrors: {},
  }
}

export async function localRequest(method: string, path: string, body?: unknown) {
  return (await openApi()).request(method, path, body)
}
