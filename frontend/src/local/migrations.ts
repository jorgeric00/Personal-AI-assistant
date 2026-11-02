/**
 * Esquema de la base de datos local, una entrada por versión. Nunca se cambia una versión ya publicada: se añade otra.
 * Es el mismo modelo que las migraciones del servidor, sin usuario (la app es de una sola persona) y con fechas en
 * texto ISO.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE app_setting (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
  );

  CREATE TABLE task_category (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL,
      created_at TEXT NOT NULL
  );

  -- Una tarea recurrente es una sola fila: due_date es la próxima aparición pendiente y avanza al completarla.
  CREATE TABLE task (
      id                      TEXT PRIMARY KEY,
      kind                    TEXT NOT NULL CHECK (kind IN ('TASK', 'REMINDER')),
      title                   TEXT NOT NULL,
      description             TEXT,
      due_date                TEXT,
      due_time                TEXT,
      deadline                TEXT,
      priority                TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
      category_id             TEXT REFERENCES task_category (id) ON DELETE SET NULL,
      status                  TEXT NOT NULL CHECK (status IN ('PENDING', 'POSTPONED', 'DONE')),
      recurrence_frequency    TEXT CHECK (recurrence_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
      recurrence_interval     INTEGER,
      recurrence_weekdays     TEXT,
      recurrence_anchor       TEXT,
      recurrence_until        TEXT,
      reminder_minutes_before INTEGER,
      completed_at            TEXT,
      created_at              TEXT NOT NULL,
      updated_at              TEXT NOT NULL
  );

  CREATE INDEX task_status_due_idx ON task (status, due_date);

  -- Apariciones completadas de tareas recurrentes (la clave impide completar dos veces la misma).
  CREATE TABLE task_completion (
      task_id         TEXT NOT NULL REFERENCES task (id) ON DELETE CASCADE,
      occurrence_date TEXT NOT NULL,
      completed_at    TEXT NOT NULL,
      PRIMARY KEY (task_id, occurrence_date)
  );
  `,
]
