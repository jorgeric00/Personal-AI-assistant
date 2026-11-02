import type { Database, SqlValue } from 'sql.js'

import { MIGRATIONS } from './migrations'

export type Param = SqlValue | boolean | undefined
export type Row = Record<string, SqlValue>

/** Base de datos SQLite de la app (sql.js), con consultas tipadas y migraciones por versión. */
export class LocalDb {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
    this.db.run('PRAGMA foreign_keys = ON')
    this.migrate()
  }

  all<T = Row>(sql: string, params: Param[] = []): T[] {
    const statement = this.db.prepare(sql)
    try {
      statement.bind(params.map(toSql))
      const rows: T[] = []
      while (statement.step()) rows.push(statement.getAsObject() as T)
      return rows
    } finally {
      statement.free()
    }
  }

  get<T = Row>(sql: string, params: Param[] = []): T | undefined {
    return this.all<T>(sql, params)[0]
  }

  run(sql: string, params: Param[] = []): void {
    this.db.run(sql, params.map(toSql))
  }

  /** Ejecuta todo o nada: si algo falla, deshace los cambios. */
  transaction<T>(work: () => T): T {
    this.db.run('BEGIN')
    try {
      const result = work()
      this.db.run('COMMIT')
      return result
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  /** Copia completa para guardarla. sql.js reabre la base al exportar, así que hay que reactivar las claves ajenas. */
  export(): Uint8Array {
    const bytes = this.db.export()
    this.db.run('PRAGMA foreign_keys = ON')
    return bytes
  }

  version(): number {
    return Number(this.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0)
  }

  private migrate() {
    const current = this.version()
    MIGRATIONS.slice(current).forEach((sql, index) => {
      this.transaction(() => {
        this.db.exec(sql)
        this.db.run(`PRAGMA user_version = ${current + index + 1}`)
      })
    })
  }
}

function toSql(value: Param): SqlValue {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}
