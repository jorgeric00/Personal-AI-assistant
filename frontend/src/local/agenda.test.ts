import { describe, expect, it } from 'vitest'

import { failure, openTestApi } from './testing'

async function categories(get: (path: string) => Promise<any>) {
  return (await get('/api/agenda/categories')) as { id: string; name: string; archived: boolean; inUse: boolean }[]
}

describe('agenda en la base de datos local', () => {
  it('crea las categorías iniciales una sola vez, en el idioma de la app, y las guarda', async () => {
    const { get, send, storage } = await openTestApi()
    await send('PATCH', '/api/me/preferences', { locale: 'es' })
    const first = await categories(get)
    expect(first.map((c) => c.name)).toContain('Gimnasio')
    expect(first).toHaveLength(9)
    const reopened = await openTestApi('2026-10-14T09:00:00Z', storage)
    expect((await categories(reopened.get)).map((c) => c.id)).toEqual(first.map((c) => c.id))

    // Si se borran, no vuelven a aparecer.
    for (const c of first) await send('DELETE', `/api/agenda/categories/${c.id}`)
    expect(await categories(get)).toEqual([])
  })

  it('lista apariciones repetidas y de varios días, con su estado', async () => {
    const { get, send } = await openTestApi()
    const [category] = await categories(get)
    const padel = await send('POST', '/api/agenda/activities', {
      title: 'Pádel',
      categoryId: category.id,
      startDate: '2026-10-05',
      startTime: '19:00',
      endDate: '2026-10-05',
      endTime: '20:30',
      recurrence: { frequency: 'WEEKLY', interval: 1, weekdays: ['THURSDAY', 'MONDAY'], until: null },
    })
    expect(padel.recurrence).toEqual({ frequency: 'WEEKLY', interval: 1, weekdays: ['MONDAY', 'THURSDAY'], until: null })
    const trip = await send('POST', '/api/agenda/activities', {
      title: 'Viaje a Lisboa',
      categoryId: category.id,
      startDate: '2026-10-10',
      endDate: '2026-10-13',
      location: '  Lisboa ',
    })
    await send('PUT', `/api/agenda/activities/${padel.id}/occurrences/2026-10-12`, { status: 'DONE' })
    const missing = await failure(send('PUT', `/api/agenda/activities/${padel.id}/occurrences/2026-10-13`, { status: 'DONE' }))
    expect(missing.status).toBe(404)

    const week = await get('/api/agenda?from=2026-10-12&to=2026-10-18')
    expect(week.map((i: any) => [i.date, i.title, i.startTime, i.endDate, i.status])).toEqual([
      ['2026-10-10', 'Viaje a Lisboa', null, '2026-10-13', 'PLANNED'],
      ['2026-10-12', 'Pádel', '19:00:00', '2026-10-12', 'DONE'],
      ['2026-10-15', 'Pádel', '19:00:00', '2026-10-15', 'PLANNED'],
    ])
    expect(week[0]).toMatchObject({ kind: 'ACTIVITY', id: trip.id, location: 'Lisboa', recurring: false })

    await send('PUT', `/api/agenda/activities/${padel.id}/occurrences/2026-10-12`, { status: 'PLANNED' })
    expect((await get('/api/agenda?from=2026-10-12&to=2026-10-12')).find((i: any) => i.title === 'Pádel').status).toBe(
      'PLANNED',
    )
  })

  it('valida como el servidor y no borra categorías en uso', async () => {
    const { get, send } = await openTestApi()
    const [category, other] = await categories(get)
    const times = await failure(
      send('POST', '/api/agenda/activities', {
        title: 'Cita',
        categoryId: category.id,
        startDate: '2026-10-14',
        startTime: '10:00',
        endDate: '2026-10-14',
      }),
    )
    expect(times.fieldErrors).toEqual({ endTime: 'agenda.activity.time.both' })
    const order = await failure(
      send('POST', '/api/agenda/activities', {
        title: 'Cita',
        categoryId: category.id,
        startDate: '2026-10-14',
        startTime: '10:00',
        endDate: '2026-10-14',
        endTime: '09:00',
      }),
    )
    expect(order.fieldErrors).toEqual({ endDate: 'agenda.activity.end.before-start' })
    expect((await failure(get('/api/agenda?from=2026-10-01&to=2026-12-31'))).fieldErrors).toEqual({
      to: 'agenda.range.invalid',
    })

    await send('POST', '/api/agenda/activities', {
      title: 'Cita',
      categoryId: category.id,
      startDate: '2026-10-14',
      endDate: '2026-10-14',
    })
    expect((await failure(send('DELETE', `/api/agenda/categories/${category.id}`))).code).toBe('activity-category-in-use')
    await send('PUT', `/api/agenda/categories/${other.id}`, { name: other.name, color: '#123456', archived: true })
    const archived = await failure(
      send('POST', '/api/agenda/activities', {
        title: 'Otra',
        categoryId: other.id,
        startDate: '2026-10-14',
        endDate: '2026-10-14',
      }),
    )
    expect(archived.fieldErrors).toEqual({ categoryId: 'agenda.activity.category.required' })
    const duplicate = await failure(send('POST', '/api/agenda/categories', { name: category.name.toUpperCase(), color: '#000000' }))
    expect(duplicate.fieldErrors).toEqual({ name: 'agenda.category.name.duplicate' })
  })
})
