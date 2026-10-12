import { describe, expect, it } from 'vitest'

import type { AgendaItem } from './api'
import { conflictsWith, coversDay, findOverlaps, formatMinutes, itemKey, summarize } from './schedule'

const sport = { id: 'c1', name: 'Pádel y deporte', color: '#16a34a' }
const friends = { id: 'c2', name: 'Amigos', color: '#db2777' }

function activity(overrides: Partial<AgendaItem>): AgendaItem {
  const date = overrides.date ?? '2026-10-13'
  return {
    kind: 'ACTIVITY',
    id: 'a1',
    date,
    title: 'Pádel',
    category: sport,
    startDate: date,
    startTime: '19:00:00',
    endDate: date,
    endTime: '20:30:00',
    location: null,
    status: 'PLANNED',
    recurring: false,
    ...overrides,
  }
}

describe('solapamientos', () => {
  it('marca las actividades que se pisan, incluidas las de varios días', () => {
    const padel = activity({})
    const dinner = activity({ id: 'a2', title: 'Cena', startTime: '20:00:00', endTime: '22:00:00' })
    const next = activity({ id: 'a3', title: 'Paseo', startTime: '22:00:00', endTime: '23:00:00' })
    const night = activity({
      id: 'a4',
      title: 'Viaje en tren',
      date: '2026-10-12',
      startDate: '2026-10-12',
      endDate: '2026-10-13',
      startTime: '23:00:00',
      endTime: '19:30:00',
    })
    const overlaps = findOverlaps([padel, dinner, next, night])
    // Acabar a la hora en que empieza otra no es solaparse
    expect([...overlaps].sort()).toEqual([itemKey(padel), itemKey(dinner), itemKey(night)].sort())
  })

  it('no cuenta lo cancelado, lo no hecho ni lo que no tiene hora', () => {
    const padel = activity({})
    expect(findOverlaps([padel, activity({ id: 'a2', status: 'CANCELLED' })]).size).toBe(0)
    expect(findOverlaps([padel, activity({ id: 'a2', status: 'MISSED' })]).size).toBe(0)
    expect(findOverlaps([padel, activity({ id: 'a2', startTime: null, endTime: null })]).size).toBe(0)
  })

  it('compara un borrador con la agenda sin contar la actividad que se edita', () => {
    const items = [activity({}), activity({ id: 'a2', title: 'Cena', startTime: '21:00:00', endTime: '22:00:00' })]
    const draft = { startDate: '2026-10-13', startTime: '20:00', endDate: '2026-10-13', endTime: '21:30' }
    expect(conflictsWith(draft, items).map((i) => i.title)).toEqual(['Pádel', 'Cena'])
    expect(conflictsWith(draft, items, 'a1').map((i) => i.title)).toEqual(['Cena'])
    expect(conflictsWith({ ...draft, startTime: null, endTime: null }, items)).toEqual([])
  })

  it('una actividad ocupa cada día entre su inicio y su fin, salvo si acaba a medianoche', () => {
    const trip = activity({ startDate: '2026-10-16', endDate: '2026-10-18', startTime: null, endTime: null })
    expect(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].map((d) => coversDay(trip, d))).toEqual([
      false,
      true,
      true,
      true,
    ])
    const party = activity({ startDate: '2026-10-16', endDate: '2026-10-17', startTime: '22:00:00', endTime: '00:00:00' })
    expect(coversDay(party, '2026-10-17')).toBe(false)
  })
})

describe('resumen del periodo', () => {
  it('suma horas por categoría recortadas al periodo y compara lo planificado con lo hecho', () => {
    const items: AgendaItem[] = [
      activity({ status: 'DONE' }),
      activity({ id: 'a2', title: 'Cena', category: friends, startTime: '21:00:00', endTime: '23:00:00' }),
      activity({ id: 'a3', date: '2026-10-14', status: 'MISSED' }),
      activity({ id: 'a4', date: '2026-10-15', status: 'CANCELLED' }),
      activity({ id: 'a5', date: '2026-10-17' }),
      // Empieza el domingo a las 23:00 y acaba el lunes siguiente: solo cuenta una hora
      activity({ id: 'a6', date: '2026-10-18', startDate: '2026-10-18', endDate: '2026-10-19', startTime: '23:00:00', endTime: '02:00:00' }),
      { ...activity({ id: 'w1', date: '2026-10-12', status: 'DONE', category: null }), kind: 'WORKOUT' },
      { ...activity({ id: 'r1', date: '2026-10-15', status: 'PLANNED', category: null }), kind: 'ROUTINE' },
    ]
    const summary = summarize(items, '2026-10-12', '2026-10-18', '2026-10-15')
    expect(summary.hours.map((h) => [h.category.name, h.plannedMinutes, h.doneMinutes])).toEqual([
      ['Pádel y deporte', 90 * 4 - 30, 90],
      ['Amigos', 120, 0],
    ])
    // Pasado o de hoy: pádel hecho, cena sin marcar, pádel no hecho y el entreno; la rutina de hoy aún no cuenta
    expect(summary).toMatchObject({ due: 4, done: 2, missed: 1, unreviewed: 1 })
  })

  it('formatea minutos como horas', () => {
    const units = { h: 'h', min: 'min' }
    expect(formatMinutes(90, units)).toBe('1 h 30 min')
    expect(formatMinutes(120, units)).toBe('2 h')
    expect(formatMinutes(45, units)).toBe('45 min')
  })
})
