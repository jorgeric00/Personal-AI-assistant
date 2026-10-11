import { describe, expect, it } from 'vitest'

import { json, mockFetch } from '../test/utils'
import { ApiError, apiFetch } from './client'

describe('apiFetch', () => {
  it('obtiene el token CSRF y lo envía en peticiones que modifican datos', async () => {
    const fetchMock = mockFetch({
      'GET /api/auth/csrf': () => {
        document.cookie = 'XSRF-TOKEN=token-123; path=/'
        return json({ headerName: 'X-XSRF-TOKEN', token: 'token-123' })
      },
      'POST /api/cosas': () => json({ ok: true }),
    })

    await expect(apiFetch('/api/cosas', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ ok: true })

    const init = fetchMock.mock.calls[1]?.[1]
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('token-123')
    expect(init?.body).toBe('{"a":1}')
  })

  it('no pide token CSRF en lecturas', async () => {
    const fetchMock = mockFetch({ 'GET /api/cosas': () => json([]) })
    await apiFetch('/api/cosas')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('convierte un problem+json en ApiError con errores por campo', async () => {
    mockFetch({
      'GET /api/cosas': () =>
        json({ title: 'Datos no válidos', detail: 'Revisa los campos marcados.', errors: { email: 'Mal' } }, 400),
    })
    const error = await apiFetch('/api/cosas').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'Revisa los campos marcados.', fieldErrors: { email: 'Mal' } })
  })

  it('informa de la falta de conexión con un mensaje claro', async () => {
    mockFetch({
      'GET /api/cosas': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await expect(apiFetch('/api/cosas')).rejects.toMatchObject({ status: 0, title: 'Sin conexión' })
  })

  it('devuelve undefined en respuestas 204', async () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/'
    mockFetch({ 'POST /api/auth/logout': () => new Response(null, { status: 204 }) })
    await expect(apiFetch('/api/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })
})
