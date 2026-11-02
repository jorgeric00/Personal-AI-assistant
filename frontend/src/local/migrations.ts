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
  `,  `
  -- Notas. search_text guarda título, contenido y etiquetas en minúsculas y sin tildes para buscar.
  CREATE TABLE note (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '',
      body        TEXT NOT NULL DEFAULT '',
      state       TEXT NOT NULL CHECK (state IN ('ACTIVE', 'ARCHIVED', 'TRASHED')),
      pinned      INTEGER NOT NULL DEFAULT 0,
      favorite    INTEGER NOT NULL DEFAULT 0,
      search_text TEXT NOT NULL DEFAULT '',
      trashed_at  TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      CHECK ((state = 'TRASHED') = (trashed_at IS NOT NULL))
  );

  CREATE TABLE note_tag (
      note_id TEXT NOT NULL REFERENCES note (id) ON DELETE CASCADE,
      name    TEXT NOT NULL,
      PRIMARY KEY (note_id, name)
  );

  -- Tareas relacionadas con una nota, en el orden en que se eligieron.
  CREATE TABLE note_task (
      note_id  TEXT NOT NULL REFERENCES note (id) ON DELETE CASCADE,
      task_id  TEXT NOT NULL REFERENCES task (id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      PRIMARY KEY (note_id, task_id)
  );

  CREATE INDEX note_task_task_idx ON note_task (task_id);
  `,  `
  -- Hábitos. DAILY: todos los días o solo los indicados en weekdays (MONDAY,…); WEEKLY: unas veces por semana.
  CREATE TABLE habit (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      color          TEXT NOT NULL,
      frequency      TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY')),
      weekdays       TEXT,
      times_per_week INTEGER CHECK (times_per_week BETWEEN 1 AND 7),
      start_date     TEXT NOT NULL,
      archived       INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      CHECK (frequency <> 'WEEKLY' OR times_per_week IS NOT NULL)
  );

  -- Días en que se cumplió cada hábito (como mucho una marca por día).
  CREATE TABLE habit_check (
      habit_id   TEXT NOT NULL REFERENCES habit (id) ON DELETE CASCADE,
      date       TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (habit_id, date)
  );
  `,
]
