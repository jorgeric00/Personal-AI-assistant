/** Lectura defensiva del cuerpo JSON de una petición: cada campo se comprueba como haría Jackson en el servidor. */

export type Body = Record<string, unknown>

export function asBody(value: unknown): Body {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Body) : {}
}

export function text(body: Body, field: string): string | null {
  const value = body[field]
  return typeof value === 'string' ? value : null
}

export function int(body: Body, field: string): number | null {
  const value = body[field]
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

export function oneOf<T extends string>(body: Body, field: string, options: readonly T[]): T | null {
  const value = body[field]
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : null
}

export function isBlank(value: string | null): boolean {
  return value === null || value.trim() === ''
}

export function blankToNull(value: string | null): string | null {
  return value === null || value.trim() === '' ? null : value.trim()
}
