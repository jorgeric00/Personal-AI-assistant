import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { apiFetch } from '../api/client'
import { json, mockFetch, renderApp, testUser } from '../test/utils'
import i18n from '.'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}

describe('internacionalización', () => {
  it('usa español por defecto', async () => {
    mockFetch({ 'GET /api/auth/me': () => json({}, 401) })
    renderApp('/login')
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
  })

  it('envía el idioma actual al servidor', async () => {
    const fetchMock = mockFetch({ 'GET /api/cosas': () => json({}) })
    await i18n.changeLanguage('en')
    await apiFetch('/api/cosas')
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Accept-Language')).toBe('en')
  })

  it('aplica el idioma guardado en la cuenta', async () => {
    mockFetch({ 'GET /api/auth/me': () => json({ ...testUser, locale: 'en' }) })
    renderApp('/ajustes')
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Today' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
  })

  it('cambia de idioma desde ajustes y lo guarda en la cuenta', async () => {
    let locale = 'es'
    mockFetch({
      'GET /api/auth/me': () => json({ ...testUser, locale }),
      'GET /api/auth/csrf': csrf,
      'PATCH /api/me/preferences': (init) => {
        locale = JSON.parse(String(init?.body)).locale
        return json({ ...testUser, locale })
      },
    })
    renderApp('/ajustes')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('radio', { name: 'English' }))

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(locale).toBe('en')
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
    expect(localStorage.getItem('lifeos.language')).toBe('en')
  })

  it('avisa si no se puede guardar el idioma', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/auth/csrf': csrf,
      'PATCH /api/me/preferences': () => json({}, 500),
    })
    renderApp('/ajustes')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('radio', { name: 'English' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido guardar el idioma.'))
    expect(i18n.language).toBe('es')
  })
})
