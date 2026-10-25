import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../test/utils'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}

describe('autenticación', () => {
  it('redirige al login cuando no hay sesión', async () => {
    mockFetch({ 'GET /api/auth/me': () => json({}, 401) })
    const { router } = renderApp('/ajustes')
    expect(await screen.findByRole('heading', { name: 'LifeOS' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('inicia sesión y vuelve a la página que se pedía, con sus parámetros', async () => {
    let loggedIn = false
    mockFetch({
      'GET /api/auth/me': () => (loggedIn ? json(testUser) : json({}, 401)),
      'GET /api/auth/csrf': csrf,
      'POST /api/auth/login': (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ email: 'jorge@example.com', password: 'secreto' })
        loggedIn = true
        return json(testUser)
      },
    })
    // Los atajos del icono abren pantallas con parámetros (por ejemplo, un formulario nuevo)
    const { router } = renderApp('/ajustes?borrar=1')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Correo electrónico'), ' jorge@example.com ')
    await user.type(screen.getByLabelText('Contraseña'), 'secreto')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/ajustes')
    expect(router.state.location.search).toBe('?borrar=1')
    expect(await screen.findByRole('dialog', { name: 'Borrar datos' })).toBeInTheDocument()
  })

  it('muestra el error del servidor si las credenciales no son válidas', async () => {
    mockFetch({
      'GET /api/auth/me': () => json({}, 401),
      'GET /api/auth/csrf': csrf,
      'POST /api/auth/login': () =>
        json({ title: 'No se ha podido iniciar sesión', detail: 'Correo electrónico o contraseña incorrectos.' }, 401),
    })
    renderApp('/login')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Correo electrónico'), 'jorge@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'mal')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo electrónico o contraseña incorrectos.')
  })

  it('marca los campos con errores de validación', async () => {
    mockFetch({
      'GET /api/auth/me': () => json({}, 401),
      'GET /api/auth/csrf': csrf,
      'POST /api/auth/login': () =>
        json({ title: 'Datos no válidos', detail: 'Revisa', errors: { email: 'El correo electrónico no es válido' } }, 400),
    })
    renderApp('/login')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Correo electrónico'), 'x')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('El correo electrónico no es válido')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true')
  })

  it('ofrece reintentar si el servidor no responde', async () => {
    mockFetch({ 'GET /api/auth/me': () => json({}, 503) })
    renderApp('/')
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('sesión iniciada', () => {
  it('muestra el saludo con el nombre en el inicio', async () => {
    mockFetch({ 'GET /api/auth/me': () => json(testUser) })
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: /, Jorge$/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page')
  })

  it('cambia el tema y lo recuerda', async () => {
    mockFetch({ 'GET /api/auth/me': () => json(testUser) })
    renderApp('/ajustes')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('radio', { name: 'Oscuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('lifeos.theme')).toBe('dark')

    await user.click(screen.getByRole('radio', { name: 'Sistema' }))
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('lifeos.theme')).toBeNull()
  })

  it('cierra sesión y vuelve al login', async () => {
    let loggedIn = true
    mockFetch({
      'GET /api/auth/me': () => (loggedIn ? json(testUser) : json({}, 401)),
      'GET /api/auth/csrf': csrf,
      'POST /api/auth/logout': () => {
        loggedIn = false
        return new Response(null, { status: 204 })
      },
    })
    const { router } = renderApp('/ajustes')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })
})
