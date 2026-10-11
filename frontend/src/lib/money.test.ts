import { describe, expect, it } from 'vitest'

import { centsToInput, formatMoney as format, parseAmount } from './money'

// Intl separa el símbolo con un espacio duro; se normaliza para comparar.
const formatMoney = (...args: Parameters<typeof format>) => format(...args).replace(/\s/g, ' ')

describe('importes', () => {
  it('lee importes escritos de formas habituales', () => {
    expect(parseAmount('12')).toBe(1200)
    expect(parseAmount('12,5')).toBe(1250)
    expect(parseAmount('12.50')).toBe(1250)
    expect(parseAmount('0,07')).toBe(7)
    expect(parseAmount('1.234,56')).toBe(123456)
    expect(parseAmount('1,234.56')).toBe(123456)
    expect(parseAmount('1.234')).toBe(123400)
    expect(parseAmount(' 19,99 € ')).toBe(1999)
  })

  it('rechaza lo que no es un importe positivo', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('12,345,6')).toBeNull()
  })

  it('formatea sin errores de redondeo', () => {
    expect(formatMoney(1999, 'EUR', 'es-ES')).toBe('19,99 €')
    expect(formatMoney(10, 'EUR', 'es-ES')).toBe('0,10 €')
    expect(formatMoney(-123456, 'EUR', 'es-ES')).toBe('-1234,56 €')
    expect(formatMoney(2500, 'EUR', 'en-GB', { signed: true })).toBe('+€25.00')
    expect(centsToInput(1205, 'es-ES')).toBe('12,05')
  })
})
