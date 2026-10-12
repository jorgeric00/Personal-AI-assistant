-- Marca que las categorías iniciales de la agenda ya se crearon para el usuario (aunque luego las borre).
CREATE TABLE agenda_settings (
    user_id    UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE activity_category (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    color      VARCHAR(7)  NOT NULL,
    archived   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX activity_category_name_uk ON activity_category (user_id, lower(name));

-- Actividades de la agenda. Una actividad repetida es una sola fila: sus apariciones se calculan con la regla
-- (anclada en start_date) y conservan la duración de la primera. Las horas son locales; sin horas = todo el día.
CREATE TABLE activity (
    id                   UUID PRIMARY KEY,
    user_id              UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    title                VARCHAR(200) NOT NULL,
    category_id          UUID         NOT NULL REFERENCES activity_category (id),
    start_date           DATE         NOT NULL,
    start_time           TIME,
    end_date             DATE         NOT NULL,
    end_time             TIME,
    description          VARCHAR(2000),
    location             VARCHAR(200),
    recurrence_frequency VARCHAR(10) CHECK (recurrence_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    recurrence_interval  INT,
    recurrence_weekdays  VARCHAR(80),
    recurrence_until     DATE,
    created_at           TIMESTAMPTZ  NOT NULL,
    updated_at           TIMESTAMPTZ  NOT NULL,
    CONSTRAINT activity_times_together CHECK ((start_time IS NULL) = (end_time IS NULL)),
    CONSTRAINT activity_end_after_start CHECK (
        end_date > start_date OR (end_date = start_date AND (end_time IS NULL OR end_time > start_time))),
    CONSTRAINT activity_recurrence_complete CHECK (recurrence_frequency IS NULL OR recurrence_interval IS NOT NULL)
);

CREATE INDEX activity_user_start_idx ON activity (user_id, start_date);
CREATE INDEX activity_category_idx ON activity (category_id);

-- Estado de una aparición concreta (por su fecha de inicio). Sin fila = planificada.
CREATE TABLE activity_occurrence (
    activity_id     UUID        NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
    occurrence_date DATE        NOT NULL,
    status          VARCHAR(10) NOT NULL CHECK (status IN ('PLANNED', 'CONFIRMED', 'DONE', 'MISSED', 'CANCELLED')),
    updated_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (activity_id, occurrence_date)
);
