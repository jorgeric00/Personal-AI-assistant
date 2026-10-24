import { screen, within } from '@testing-library/react'
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
