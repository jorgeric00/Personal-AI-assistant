/** Error de la API local con la misma forma que los ProblemDetail del servidor (claves de messages.ts). */
export class LocalError extends Error {
  readonly status: number
  /** Clave del error: error.<code>.title / error.<code>.detail. */
  readonly code: string
  /** Campo → clave del mensaje. */
  readonly fieldErrors: Record<string, string>

  constructor(status: number, code: string, fieldErrors: Record<string, string> = {}) {
    super(code)
    this.name = 'LocalError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export const notFound = () => new LocalError(404, 'not-found')
export const conflict = (code: string) => new LocalError(409, code)

/** Reúne errores de validación por campo y los lanza juntos, como FieldValidationException.Collector. */
export class Validator {
  private readonly errors: Record<string, string> = {}

  add(condition: boolean, field: string, key: string): this {
    if (condition && !(field in this.errors)) this.errors[field] = key
    return this
  }

  throwIfAny(): void {
    if (Object.keys(this.errors).length > 0) throw new LocalError(400, 'validation', this.errors)
  }
}
