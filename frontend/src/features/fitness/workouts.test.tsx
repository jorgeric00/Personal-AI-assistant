import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Exercise, ExerciseRecord, Routine, Workout, WorkoutSummary } from './api'

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}
const body = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

const squat: Exercise = {
  id: 'e1',
  name: 'Sentadilla con barra',
  muscleGroup: 'LEGS',
  type: 'STRENGTH',
  equipment: null,
  instructions: null,
  safety: null,
  archived: false,
  inUse: true,
}
const plank: Exercise = { ...squat, id: 'e2', name: 'Plancha', muscleGroup: 'CORE', type: 'TIMED' }
const summary = (e: Exercise) => ({ id: e.id, name: e.name, muscleGroup: e.muscleGroup, type: e.type, archived: e.archived })
const noTarget = { repsMin: null, repsMax: null, weightKg: null, durationSeconds: null, distanceKm: null, restSeconds: null, notes: null }

// 2026-10-11 es domingo
const routines: Routine[] = [
  { id: 'r1', name: 'Pierna', notes: null, weekdays: ['SUNDAY'], exercises: [{ ...noTarget, id: 'i1', exercise: summary(squat), sets: 2 }] },
  { id: 'r2', name: 'Torso', notes: null, weekdays: ['MONDAY'], exercises: [] },
]

const emptySet = { reps: null, weightKg: null, durationSeconds: null, distanceKm: null, done: false }
const workout: Workout = {
  id: 'w1',
  routineId: 'r1',
  name: 'Pierna',
  date: '2026-10-11',
  finished: false,
  finishedAt: null,
  effort: null,
  notes: null,
  exercises: [
    {
      id: 'we1',
      exercise: summary(squat),
      targetSets: 2,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetWeightKg: 60,
      targetDurationSeconds: null,
      targetDistanceKm: null,
      restSeconds: 120,
      notes: null,
      sets: [
        { ...emptySet, id: 's1' },
        { ...emptySet, id: 's2' },
      ],
      previous: {
        workoutId: 'w0',
        date: '2026-10-06',
        sets: [
          { ...emptySet, id: 'p1', reps: 8, weightKg: 60, done: true },
          { ...emptySet, id: 'p2', reps: 7, weightKg: 60, done: true },
        ],
      },
    },
  ],
}

function finishedSummary(overrides: Partial<WorkoutSummary>): WorkoutSummary {
  return { id: 'w0', routineId: 'r1', name: 'Pierna', date: '2026-10-06', finished: true, finishedAt: '2026-10-06T18:00:00Z', exerciseCount: 1, doneSets: 2, ...overrides }
}

const records: ExerciseRecord[] = [
  {
    exerciseId: 'e1',
    exerciseName: 'Sentadilla con barra',
    type: 'STRENGTH',
    sessions: 2,
    bestWeightKg: 62.5,
    bestWeightReps: 6,
    bestWeightDate: '2026-10-06',
    bestReps: 8,
    bestRepsDate: '2026-10-01',
    longestDurationSeconds: null,
    longestDurationDate: null,
    longestDistanceKm: null,
    longestDistanceDate: null,
  },
]

const emptyProfile = { daysPerWeek: 3 }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('entrenamientos', () => {
  it('muestra lo que toca hoy, la constancia frente al objetivo, los récords y el historial', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/routines': () => json(routines),
      'GET /api/fitness/exercises': () => json([squat, plank]),
      'GET /api/fitness/profile': () => json(emptyProfile),
      'GET /api/fitness/records': () => json(records),
      'GET /api/fitness/workouts': () =>
        json([
          finishedSummary({ id: 'w2', date: '2026-10-08', doneSets: 4 }),
          finishedSummary({ id: 'w1', date: '2026-10-06' }),
          finishedSummary({ id: 'w0', date: '2026-10-06', name: 'Segunda del día' }),
          finishedSummary({ id: 'wx', date: '2026-09-30' }),
        ]),
    })
    renderApp('/entreno')

    const start = (await screen.findByRole('heading', { name: 'Hoy toca' })).closest('section')!
    const rows = within(start).getAllByRole('listitem').map((li) => li.textContent)
    expect(rows[0]).toContain('PiernaHoy')
    expect(within(start).getByRole('button', { name: 'Empezar Pierna' })).toHaveClass('button-primary')
    expect(within(start).getByRole('button', { name: 'Empezar Torso' })).toHaveClass('button-secondary')

    // Dos entrenamientos el mismo día cuentan como un día
    expect(screen.getByText('Esta semana: 2 de 3 días')).toBeInTheDocument()

    const recordsSection = screen.getByRole('heading', { name: 'Récords personales' }).closest('section')!
    expect(recordsSection).toHaveTextContent('Más peso: 62,5 kg × 6 (6 oct 2026)')
    expect(recordsSection).toHaveTextContent('2 sesiones')

    const history = screen.getByRole('heading', { name: 'Historial' }).closest('section')!
    expect(within(history).getAllByRole('listitem')).toHaveLength(4)
    expect(within(history).getAllByRole('listitem')[0]).toHaveTextContent('8 oct 2026 · 1 ejercicio · 4 series hechas')
  })

  it('empieza desde una rutina, anota series y no deja terminar sin ninguna hecha', async () => {
    let saved: ReturnType<typeof body> = null
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/routines': () => json(routines),
      'GET /api/fitness/exercises': () => json([squat, plank]),
      'GET /api/fitness/profile': () => json({ daysPerWeek: null }),
      'GET /api/fitness/records': () => json([]),
      'GET /api/fitness/workouts': () => json([]),
      'GET /api/auth/csrf': csrf,
      'POST /api/fitness/workouts': (init) => {
        expect(body(init)).toEqual({ routineId: 'r1', date: null })
        return json(workout, 201)
      },
      'GET /api/fitness/workouts/w1': () => json(workout),
      'PUT /api/fitness/workouts/w1': (init) => {
        saved = body(init)
        return json({ ...workout, finished: saved.finished })
      },
    })
    const { router } = renderApp('/entreno')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Empezar Pierna' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/entreno/sesion/w1'))

    const card = (await screen.findByRole('heading', { name: 'Sentadilla con barra' })).closest('li')!
    expect(card).toHaveTextContent('Objetivo: 2 × 6–8 · 60 kg · descanso 2 min')
    expect(card).toHaveTextContent('Última vez (6 oct 2026): 8 × 60 kg, 7 × 60 kg')
    const finish = screen.getByRole('button', { name: 'Terminar entrenamiento' })
    expect(finish).toBeDisabled()

    await user.type(within(card).getByLabelText('Reps., serie 1'), '8')
    await user.type(within(card).getByLabelText('Peso (kg), serie 1'), '62,5')
    await user.click(within(card).getByRole('button', { name: 'Serie 1 hecha' }))
    expect(within(card).getByRole('button', { name: 'Serie 1 hecha' })).toHaveAttribute('aria-pressed', 'true')
    // La siguiente serie parte de esos valores sin darse por hecha
    expect(within(card).getByLabelText('Reps., serie 2')).toHaveValue('8')
    expect(within(card).getByRole('button', { name: 'Serie 2 hecha' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(card).getByRole('button', { name: 'Añadir serie' }))
    expect(within(card).getByLabelText('Peso (kg), serie 3')).toHaveValue('62,5')
    await user.click(within(card).getByRole('button', { name: 'Quitar serie 3' }))

    await user.selectOptions(screen.getByLabelText('Esfuerzo percibido'), '7')
    await user.click(finish)

    await waitFor(() => expect(router.state.location.pathname).toBe('/entreno'))
    expect(saved).toEqual({
      name: 'Pierna',
      date: '2026-10-11',
      effort: 7,
      notes: null,
      finished: true,
      exercises: [
        {
          exerciseId: 'e1',
          targetSets: 2,
          targetRepsMin: 6,
          targetRepsMax: 8,
          targetWeightKg: 60,
          targetDurationSeconds: null,
          targetDistanceKm: null,
          restSeconds: 120,
          notes: null,
          sets: [
            { reps: 8, weightKg: 62.5, durationSeconds: null, distanceKm: null, done: true },
            { reps: 8, weightKg: 62.5, durationSeconds: null, distanceKm: null, done: false },
          ],
        },
      ],
    })
  })

  it('muestra en Hoy el entrenamiento en curso', async () => {
    mockFetch({
      'GET /api/auth/me': () => json(testUser),
      'GET /api/fitness/routines': () => json(routines),
      'GET /api/fitness/workouts': () => json([finishedSummary({ id: 'w1', finished: false, finishedAt: null, date: '2026-10-11', doneSets: 3 })]),
    })
    renderApp('/')
    const section = (await screen.findByRole('heading', { name: 'Entreno' })).closest('section')!
    expect(section).toHaveTextContent('Pierna3 series hechas')
    expect(within(section).getByRole('link', { name: 'Seguir' })).toHaveAttribute('href', '/entreno/sesion/w1')
  })
})
