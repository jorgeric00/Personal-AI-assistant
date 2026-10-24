/**
 * Números con decimales de medidas corporales (kg, cm, %). No tienen separador de miles, así que «80,5» y
 * «80.5» son lo mismo.
 */

/** Lee lo que escribe el usuario: undefined si está vacío, null si no es un número válido. */
export function parseDecimal(text: string, maxDecimals = 2, maxIntegers = 3): number | null | undefined {
  const clean = text.trim().replace(',', '.')
  if (clean === '') return undefined
  const pattern = new RegExp(`^\\d{1,${maxIntegers}}(\\.\\d{1,${maxDecimals}})?$`)
  return pattern.test(clean) ? Number(clean) : null
}

/** Como parseDecimal, pero admite signo negativo y 0 decimales (indicadores propios). */
export function parseSignedDecimal(text: string, maxDecimals: number, maxIntegers = 7): number | null | undefined {
  const clean = text.trim().replace(',', '.')
  if (clean === '') return undefined
  const fraction = maxDecimals > 0 ? `(\\.\\d{1,${maxDecimals}})?` : ''
  const pattern = new RegExp(`^-?\\d{1,${maxIntegers}}${fraction}$`)
  return pattern.test(clean) ? Number(clean) : null
}

/** Valor para rellenar un campo, con la coma decimal en español. */
export function decimalToInput(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return locale.startsWith('es') ? text.replace('.', ',') : text
}

export function formatDecimal(value: number, locale: string, maxDecimals = 1, signed = false) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: maxDecimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value)
}

/** Entero sin signo (series, repeticiones, segundos): undefined si está vacío, null si no es válido. */
export function parseInteger(text: string): number | null | undefined {
  const clean = text.trim()
  if (clean === '') return undefined
  return /^\d{1,5}$/.test(clean) ? Number(clean) : null
}
