import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'

describe('ajustes', () => {
  it('ofrece descargar todos los datos y avisa de que son sensibles', async () => {
    mockFetch({ 'GET /api/auth/me': () => json(testUser) })
    renderApp('/ajustes')

    const section = (await screen.findByRole('heading', { name: 'Tus datos' })).closest('section')!
    const link = within(section).getByRole('link', { name: 'Descargar mis datos' })
    expect(link).toHaveAttribute('href', '/api/export')
    expect(link).toHaveAttribute('download')
    expect(within(section).getByText(/datos personales y sensibles/)).toBeInTheDocument()
  })
})

describe('borrado de datos', () => {
  const csrf = () => {
    document.cookie = 'XSRF-TOKEN=t; path=/'
    return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
  }

  it('borra solo lo marcado tras escribir la contraseña y muestra si es incorrecta', async () => {
    const requests: unknown[] = []
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/auth/csrf': csrf,
      'POST /api/data/delete': (init) => {
        const body = JSON.parse(String(init?.body))
        requests.push(body)
        return body.password === 'buena'
          ? new Response(null, { status: 204 })
          : json({ title: 'Datos no válidos', errors: { password: 'La contraseña no es correcta' } }, 400)
      },
    })
    const { router } = renderApp('/ajustes')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Borrar datos…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Borrar datos' })
    expect(within(dialog).getByRole('link', { name: 'Descargar mis datos' })).toHaveAttribute('href', '/api/export')
    const confirm = within(dialog).getByRole('button', { name: 'Borrar para siempre' })
    expect(confirm).toBeDisabled()

    await user.click(within(dialog).getByRole('checkbox', { name: /Hábitos/ }))
    await user.click(within(dialog).getByRole('checkbox', { name: /Finanzas/ }))
    expect(within(dialog).getByRole('status')).toHaveTextContent('Vas a borrar para siempre: Finanzas y Hábitos.')
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByLabelText('Tu contraseña, para confirmar'), 'mala')
    await user.click(confirm)
    expect(await within(dialog).findByText('La contraseña no es correcta')).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('Tu contraseña, para confirmar'))
    await user.type(within(dialog).getByLabelText('Tu contraseña, para confirmar'), 'buena')
    await user.click(confirm)
    expect(await screen.findByText('Datos borrados')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(router.state.location.search).toBe('')
    expect(requests).toEqual([
      { scopes: ['FINANCE', 'HABITS'], password: 'mala' },
      { scopes: ['FINANCE', 'HABITS'], password: 'buena' },
    ])
  })

  it('marca o desmarca todo de una vez', async () => {
    mockFetch({ 'GET /api/auth/me': () => json(testUser) })
    renderApp('/ajustes?borrar=1')
    const user = userEvent.setup()
    const dialog = await screen.findByRole('dialog', { name: 'Borrar datos' })

    await user.click(within(dialog).getByRole('checkbox', { name: 'Todo' }))
    expect(within(dialog).getAllByRole('checkbox').every((box) => (box as HTMLInputElement).checked)).toBe(true)
    await user.click(within(dialog).getByRole('checkbox', { name: /Notas/ }))
    expect(within(dialog).getByRole('checkbox', { name: 'Todo' })).not.toBeChecked()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Todo' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Todo' }))
    expect(within(dialog).getAllByRole('checkbox').some((box) => (box as HTMLInputElement).checked)).toBe(false)
  })
})
