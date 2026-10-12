-- Hábitos personales. DAILY: todos los días o solo los indicados en weekdays (MONDAY,…); WEEKLY: un número de veces
-- por semana, en cualquier día. Se cuentan desde start_date. Archivar conserva el historial.
CREATE TABLE habit (
    id             UUID PRIMARY KEY,
    user_id        UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name           VARCHAR(80) NOT NULL,
    color          VARCHAR(7)  NOT NULL,
    frequency      VARCHAR(10) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY')),
    weekdays       VARCHAR(80),
    times_per_week INT CHECK (times_per_week BETWEEN 1 AND 7),
    start_date     DATE        NOT NULL,
    archived       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL,
    CONSTRAINT habit_weekly_target CHECK (frequency <> 'WEEKLY' OR times_per_week IS NOT NULL)
);

CREATE UNIQUE INDEX habit_name_uk ON habit (user_id, lower(name));

-- Días en que se cumplió cada hábito (como mucho una marca por día).
CREATE TABLE habit_check (
    habit_id   UUID        NOT NULL REFERENCES habit (id) ON DELETE CASCADE,
    date       DATE        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (habit_id, date)
);
