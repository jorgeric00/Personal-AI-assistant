/** Cliente HTTP de la API: sesión por cookie y protección CSRF con cabecera X-XSRF-TOKEN. */

import i18n, { currentLanguage } from '../i18n'

export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly fieldErrors: FieldErrors

  constructor(status: number, title: string, detail: string, fieldErrors: FieldErrors = {}) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.fieldErrors = fieldErrors
  }
}

const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

async function ensureCsrfToken(): Promise<string> {
  const existing = readCookie(CSRF_COOKIE)
  if (existing) return existing
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' })
  if (!response.ok) throw await toApiError(response)
  const body = (await response.json()) as { token: string }
  return readCookie(CSRF_COOKIE) ?? body.token
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { title?: string; detail?: string; errors?: FieldErrors }
    return new ApiError(
      response.status,
      body.title ?? i18n.t('errors.title'),
      body.detail ?? defaultMessage(response.status),
      body.errors ?? {},
    )
  } catch {
    return new ApiError(response.status, i18n.t('errors.title'), defaultMessage(response.status))
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return i18n.t('errors.unauthorized')
  if (status === 403) return i18n.t('errors.forbidden')
  if (status >= 500) return i18n.t('errors.server')
  return i18n.t('errors.generic')
}

export interface RequestOptions {
  method?: string
  body?: unknown
}

export async function apiFetch<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  // El servidor responde los errores en el idioma de la interfaz.
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': currentLanguage() }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const send = async () => {
    if (!SAFE_METHODS.has(method)) headers[CSRF_HEADER] = await ensureCsrfToken()
    return fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  let response: Response
  try {
    response = await send()
    // Un token CSRF caducado (por ejemplo tras cerrar sesión) se renueva una vez.
    if (response.status === 403 && !SAFE_METHODS.has(method)) {
      document.cookie = `${CSRF_COOKIE}=; Max-Age=0; path=/`
      response = await send()
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(0, i18n.t('errors.offlineTitle'), i18n.t('errors.offline'))
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
