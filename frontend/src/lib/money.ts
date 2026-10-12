/**
 * Importes en céntimos (enteros), como los guarda el servidor. Aquí solo se convierten para mostrarlos o
 * para leer lo que escribe el usuario, sin pasar por números con decimales.
 */

export function formatMoney(cents: number, currency: string, locale: string, options: { signed?: boolean } = {}) {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  })
  // Intl acepta cadenas decimales exactas, así que no hay redondeos al dividir entre 100.
  const negative = cents < 0
  const abs = Math.abs(cents)
  const text = `${negative ? '-' : ''}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
  return formatter.format(text as unknown as number)
}

/** Importe sin símbolo para rellenar un campo: 1999 → «19,99» (o «19.99» en inglés). */
export function centsToInput(cents: number, locale: string) {
  const separator = locale.startsWith('es') ? ',' : '.'
  return `${Math.trunc(cents / 100)}${separator}${String(cents % 100).padStart(2, '0')}`
}

/**
 * Lee un importe escrito a mano: «12», «12,5», «12.50», «1.234,56» o «1,234.56». Devuelve céntimos o null si
 * no es un importe válido. Un único separador seguido de 1 o 2 cifras se toma como decimal.
 */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/[\s€$£]/g, '')
  if (!/^\d[\d.,]*$/.test(clean)) return null
  const lastSeparator = Math.max(clean.lastIndexOf(','), clean.lastIndexOf('.'))
  let integerPart = clean
  let decimalPart = ''
  if (lastSeparator >= 0) {
    const tail = clean.slice(lastSeparator + 1)
    const separatorCount = (clean.match(/[.,]/g) ?? []).length
    const mixed = clean.includes(',') && clean.includes('.')
    if (tail.length <= 2 && (separatorCount === 1 || mixed)) {
      integerPart = clean.slice(0, lastSeparator)
      decimalPart = tail
    }
  }
  // Los separadores que quedan son de miles: cada grupo tras el primero debe tener tres cifras.
  const groups = integerPart.split(/[.,]/)
  if (groups.slice(1).some((group) => group.length !== 3)) return null
  integerPart = groups.join('')
  if (!/^\d+$/.test(integerPart) || integerPart.length > 10) return null
  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0') || '0')
  return cents > 0 ? cents : null
}
