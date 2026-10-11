/**
 * Números con decimales de medidas corporales (kg, cm, %). No tienen separador de miles, así que «80,5» y
 * «80.5» son lo mismo.
 */

/** Lee lo que escribe el usuario: undefined si está vacío, null si no es un número válido. */
export function parseDecimal(text: string, maxDecimals = 2): number | null | undefined {
  const clean = text.trim().replace(',', '.')
  if (clean === '') return undefined
  const pattern = new RegExp(`^\\d{1,3}(\\.\\d{1,${maxDecimals}})?$`)
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
