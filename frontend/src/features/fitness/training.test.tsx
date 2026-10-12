import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Exercise, Routine } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}
const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

function exercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'e1',
    name: 'Sentadilla',
    muscleGroup: 'LEGS',
    type: 'BODYWEIGHT',
    equipment: null,
    instructions: null,
    safety: null,
    archived: false,
    inUse: false,
    ...overrides,
  }
}

const catalog = [
  exercise({ id: 'e1', name: 'Correr', muscleGroup: 'CARDIO', type: 'CARDIO' }),
  exercise({ id: 'e2', name: 'Flexiones', muscleGroup: 'CHEST', type: 'BODYWEIGHT', inUse: true }),
  exercise({ id: 'e3', name: 'Plancha', muscleGroup: 'CORE', type: 'TIMED' }),
  exercise({ id: 'e4', name: 'Press de banca', muscleGroup: 'CHEST', type: 'STRENGTH', equipment: 'Barra y banco' }),
  exercise({ id: 'e5', name: 'Remo antiguo', muscleGroup: 'BACK', type: 'STRENGTH', archived: true }),
]

const target = { repsMin: null, repsMax: null, weightKg: null, durationSeconds: null, distanceKm: null, restSeconds: null, notes: null }
const summary = (e: Exercise) => ({ id: e.id, name: e.name, muscleGroup: e.muscleGroup, type: e.type, archived: e.archived })

const routine: Routine = {
  id: 'r1',
  name: 'Cuerpo completo',
  notes: null,
  weekdays: ['MONDAY', 'THURSDAY'],
  exercises: [
    { ...target, id: 'i1', exercise: summary(catalog[3]), sets: 4, repsMin: 6, repsMax: 8, weightKg: 60.5, restSeconds: 120 },
    { ...target, id: 'i2', exercise: summary(catalog[2]), sets: 3, durationSeconds: 45 },
    { ...target, id: 'i3', exercise: summary(catalog[0]), sets: 1, durationSeconds: 1200, distanceKm: 3.5 },
  ],
}

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('ejercicios y rutinas', () => {
  it('agrupa el catálogo por grupo muscular, filtra y oculta los archivados', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/exercises': () => json(catalog),
      'GET /api/fitness/routines': () => json([]),
    })
    renderApp('/entreno?vista=EXERCISES')
    const user = userEvent.setup()

    const chest = (await screen.findByRole('heading', { name: 'Pecho' })).closest('section')!
    expect(within(chest).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'FlexionesRepeticiones',
      'Press de bancaPeso y repeticiones · Barra y banco',
    ])
    expect(screen.queryByText('Remo antiguo')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Espalda' })).toBeNull()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar ejercicios' }), 'barra')
    expect(screen.getByText('Press de banca')).toBeInTheDocument()
    expect(screen.queryByText('Flexiones')).toBeNull()
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar ejercicios' }))

    await user.click(screen.getByRole('button', { name: 'Cardio' }))
    expect(screen.getByText('Correr')).toBeInTheDocument()
    expect(screen.queryByText('Plancha')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Todos' }))

    await user.click(screen.getByRole('button', { name: 'Ver 1 archivado' }))
    expect(screen.getByText('Remo antiguo')).toBeInTheDocument()
    expect(screen.getByText('Archivado')).toBeInTheDocument()
  })

  it('crea un ejercicio validando los campos obligatorios', async () => {
    let created: unknown = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/exercises': () => json(catalog),
      'GET /api/fitness/routines': () => json([]),
      'GET /api/auth/csrf': csrf,
      'POST /api/fitness/exercises': (init) => {
        created = body(init)
        return json({ ...exercise({ id: 'e9' }), ...body(init) }, 201)
      },
    })
    renderApp('/entreno?vista=EXERCISES')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Ejercicio' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo ejercicio' })
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(dialog).getByText('Escribe un nombre')).toBeInTheDocument()
    expect(within(dialog).getByText('Elige el grupo muscular')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Nombre'), ' Hip thrust ')
    await user.selectOptions(within(dialog).getByLabelText('Grupo muscular'), 'LEGS')
    await user.selectOptions(within(dialog).getByLabelText('Qué se anota'), 'STRENGTH')
    expect(within(dialog).getByText('Se anotan series, repeticiones y peso.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Material'), 'Barra')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(created).toEqual({
      name: 'Hip thrust',
      muscleGroup: 'LEGS',
      type: 'STRENGTH',
      equipment: 'Barra',
      instructions: null,
      safety: null,
      archived: false,
    })
  })

  it('no ofrece eliminar un ejercicio que está en una rutina', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/exercises': () => json(catalog),
      'GET /api/fitness/routines': () => json([]),
    })
    renderApp('/entreno?vista=EXERCISES&ejercicio=e2')
    const dialog = await screen.findByRole('dialog', { name: 'Editar ejercicio' })
    expect(within(dialog).getByText(/está en alguna rutina/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Eliminar' })).toBeNull()
  })

  it('muestra las rutinas con sus días y el objetivo de cada ejercicio', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/exercises': () => json(catalog),
      'GET /api/fitness/routines': () => json([routine]),
    })
    renderApp('/entreno?vista=ROUTINES')

    const card = (await screen.findByRole('button', { name: /Cuerpo completo/ })).closest('article')!
    expect(within(card).getByText('lun · jue')).toBeInTheDocument()
    expect(within(card).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Press de banca4 × 6–8 · 60,5 kg · descanso 2 min',
      'Plancha3 × 45 s',
      'Correr20 min · 3,5 km',
    ])
  })

  it('crea una rutina con ejercicios en orden, objetivos según el tipo y días', async () => {
    let created: unknown = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/exercises': () => json(catalog),
      'GET /api/fitness/routines': () => json([]),
      'GET /api/auth/csrf': csrf,
      'POST /api/fitness/routines': (init) => {
        created = body(init)
        return json({ ...routine, ...body(init) }, 201)
      },
    })
    renderApp('/entreno?vista=ROUTINES')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Nueva rutina' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva rutina' })
    // Los archivados no se ofrecen
    expect(within(dialog).queryByRole('option', { name: 'Remo antiguo' })).toBeNull()

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(dialog).getByText('Añade al menos un ejercicio')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Nombre'), 'Empuje')
    await user.click(within(dialog).getByRole('button', { name: 'jue' }))
    await user.click(within(dialog).getByRole('button', { name: 'lun' }))
    const add = within(dialog).getByLabelText('Añadir ejercicio')
    await user.selectOptions(add, 'e1')
    await user.selectOptions(add, 'e4')

    const items = () => within(dialog).getAllByRole('listitem')
    // Cardio: tiempo en minutos y distancia; sin series ni repeticiones
    expect(within(items()[0]).queryByLabelText('Series')).toBeNull()
    await user.type(within(items()[0]).getByLabelText('Tiempo (min)'), '25,5')
    await user.type(within(items()[0]).getByLabelText('Distancia (km)'), '4')

    await user.click(within(dialog).getByRole('button', { name: 'Subir Press de banca' }))
    const press = items()[0]
    expect(press).toHaveTextContent('1. Press de banca')
    await user.clear(within(press).getByLabelText('Series'))
    await user.type(within(press).getByLabelText('Series'), '4')
    await user.type(within(press).getByLabelText('Reps. mín.'), '10')
    await user.type(within(press).getByLabelText('Reps. máx.'), '8')
    await user.type(within(press).getByLabelText('Peso (kg)'), '60,5')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(press).getByText('El máximo no puede ser menor que el mínimo')).toBeInTheDocument()

    await user.clear(within(press).getByLabelText('Reps. máx.'))
    await user.type(within(press).getByLabelText('Reps. máx.'), '12')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(created).toEqual({
      name: 'Empuje',
      notes: null,
      weekdays: ['MONDAY', 'THURSDAY'],
      exercises: [
        { ...target, exerciseId: 'e4', sets: 4, repsMin: 10, repsMax: 12, weightKg: 60.5 },
        { ...target, exerciseId: 'e1', sets: 1, durationSeconds: 1530, distanceKm: 4 },
      ],
    })
  })
})
