import { describe, expect, it } from 'vitest'

import { failure, openTestApi } from './testing'

const habit = (overrides: Record<string, unknown> = {}) => ({
  name: 'Leer',
  color: '#0F766E',
  frequency: 'DAILY',
  weekdays: [],
  timesPerWeek: null,
  archived: false,
  ...overrides,
})

describe('hábitos en la base de datos local', () => {
  it('crea hábitos y descarta lo que no aplica a su frecuencia', async () => {
    const { api, send } = await openTestApi()
    const created = await api.request('POST', '/api/habits', habit({ name: '  Leer ', timesPerWeek: 3 }))
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      name: 'Leer',
      color: '#0f766e',
      weekdays: [],
      timesPerWeek: null,
      startDate: '2026-10-14',
      archived: false,
      checks: [],
    })
    const gym = await send('POST', '/api/habits', habit({ name: 'Gimnasio', frequency: 'WEEKLY', weekdays: ['MONDAY'], timesPerWeek: 3 }))
    expect(gym).toMatchObject({ weekdays: [], timesPerWeek: 3 })
    const some = await send('POST', '/api/habits', habit({ name: 'Correr', weekdays: ['FRIDAY', 'MONDAY'] }))
    expect(some.weekdays).toEqual(['MONDAY', 'FRIDAY'])
  })

  it('valida como el servidor', async () => {
    const { send } = await openTestApi()
    await send('POST', '/api/habits', habit())
    const duplicate = await failure(send('POST', '/api/habits', habit({ name: 'LEER' })))
    expect(duplicate.fieldErrors).toEqual({ name: 'habits.name.duplicate' })
    const weekly = await failure(send('POST', '/api/habits', habit({ name: 'Nadar', frequency: 'WEEKLY' })))
    expect(weekly.fieldErrors).toEqual({ timesPerWeek: 'habits.times.invalid' })
    const invalid = await failure(send('POST', '/api/habits', { name: ' ', color: 'rojo' }))
    expect(invalid.fieldErrors).toEqual({
      name: 'habits.name.required',
      color: 'habits.color.invalid',
      frequency: 'habits.frequency.required',
    })
  })

  it('marca y desmarca días, sin dejar marcar el futuro', async () => {
    const { get, send } = await openTestApi()
    const read = await send('POST', '/api/habits', habit())
    await send('PUT', `/api/habits/${read.id}/checks/2026-10-14`)
    await send('PUT', `/api/habits/${read.id}/checks/2026-10-14`)
    await send('PUT', `/api/habits/${read.id}/checks/2026-10-10`)
    const future = await failure(send('PUT', `/api/habits/${read.id}/checks/2026-10-15`))
    expect(future.fieldErrors).toEqual({ date: 'habits.date.future' })

    expect((await get('/api/habits?from=2026-10-01&to=2026-10-31'))[0].checks).toEqual(['2026-10-10', '2026-10-14'])
    expect((await get('/api/habits?from=2026-10-12&to=2026-10-31'))[0].checks).toEqual(['2026-10-14'])
    await send('DELETE', `/api/habits/${read.id}/checks/2026-10-10`)
    expect((await get('/api/habits?from=2026-10-01&to=2026-10-31'))[0].checks).toEqual(['2026-10-14'])

    const range = await failure(get('/api/habits?from=2026-01-01&to=2026-10-31'))
    expect(range.fieldErrors).toEqual({ to: 'habits.range.invalid' })
    await send('DELETE', `/api/habits/${read.id}`)
    expect(await get('/api/habits?from=2026-10-01&to=2026-10-31')).toEqual([])
  })
})
