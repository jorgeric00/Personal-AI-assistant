import { describe, expect, it } from 'vitest'

import { decimalToInput, formatDecimal, parseDecimal } from './decimal'

describe('decimales', () => {
  it('lee coma o punto y distingue vacío de no válido', () => {
    expect(parseDecimal('80,5')).toBe(80.5)
    expect(parseDecimal(' 80.25 ')).toBe(80.25)
    expect(parseDecimal('94')).toBe(94)
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal('80,123')).toBeNull()
    expect(parseDecimal('91,55', 1)).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1.000,5')).toBeNull()
  })

  it('formatea para mostrar y para editar', () => {
    expect(decimalToInput(80.5, 'es')).toBe('80,5')
    expect(decimalToInput(80.5, 'en')).toBe('80.5')
    expect(decimalToInput(null, 'es')).toBe('')
    expect(formatDecimal(-1.25, 'es', 1, true)).toBe('-1,3')
    expect(formatDecimal(0, 'es', 1, true)).toBe('0')
    expect(formatDecimal(2.5, 'es', 1, true)).toBe('+2,5')
  })
})
