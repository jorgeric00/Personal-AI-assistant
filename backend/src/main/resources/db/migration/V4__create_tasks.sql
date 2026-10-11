CREATE TABLE task_category (
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name       VARCHAR(50)  NOT NULL,
    color      VARCHAR(20)  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL
);

CREATE UNIQUE INDEX task_category_user_name_uk ON task_category (user_id, lower(name));

-- Tareas y recordatorios. Una tarea recurrente es una sola fila: due_date es la próxima aparición pendiente
-- y avanza al completarla, por eso nunca se generan duplicados.
CREATE TABLE task (
    id                       UUID PRIMARY KEY,
    user_id                  UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    kind                     VARCHAR(20)  NOT NULL CHECK (kind IN ('TASK', 'REMINDER')),
    title                    VARCHAR(200) NOT NULL,
    description              TEXT,
    due_date                 DATE,
    due_time                 TIME,
    deadline                 DATE,
    priority                 VARCHAR(10)  NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    category_id              UUID         REFERENCES task_category (id) ON DELETE SET NULL,
    status                   VARCHAR(20)  NOT NULL CHECK (status IN ('PENDING', 'POSTPONED', 'DONE')),
    recurrence_frequency     VARCHAR(10)  CHECK (recurrence_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    recurrence_interval      INT,
    recurrence_weekdays      VARCHAR(80),
    recurrence_anchor        DATE,
    recurrence_until         DATE,
    reminder_minutes_before  INT,
    completed_at             TIMESTAMPTZ,
    created_at               TIMESTAMPTZ  NOT NULL,
    updated_at               TIMESTAMPTZ  NOT NULL,
    CONSTRAINT task_time_needs_date CHECK (due_time IS NULL OR due_date IS NOT NULL),
    CONSTRAINT task_recurrence_complete CHECK (
        recurrence_frequency IS NULL
        OR (recurrence_interval IS NOT NULL AND recurrence_anchor IS NOT NULL AND due_date IS NOT NULL))
);

CREATE INDEX task_user_status_due_idx ON task (user_id, status, due_date);

-- Historial de apariciones completadas de tareas recurrentes (la clave impide completar dos veces la misma).
CREATE TABLE task_completion (
    task_id         UUID        NOT NULL REFERENCES task (id) ON DELETE CASCADE,
    occurrence_date DATE        NOT NULL,
    completed_at    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (task_id, occurrence_date)
);
