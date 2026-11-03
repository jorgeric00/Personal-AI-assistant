import { describe, expect, it } from 'vitest'

import { openTestApi } from './testing'

describe('cuenta en la app', () => {
  it('no pide iniciar sesión y guarda el idioma y el nombre', async () => {
    const { get, send } = await openTestApi()
    expect(await get('/api/auth/me')).toMatchObject({ id: 'local', displayName: '', timezone: 'Europe/Madrid' })
    expect(await send('PATCH', '/api/me/preferences', { locale: 'en', displayName: ' Jorge ' })).toMatchObject({
      locale: 'en',
      displayName: 'Jorge',
    })
  })
})
