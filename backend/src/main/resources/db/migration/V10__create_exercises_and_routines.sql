-- Marca que el catálogo inicial de ejercicios ya se creó para el usuario (aunque luego borre ejercicios).
CREATE TABLE fitness_settings (
    user_id    UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL
);

-- Catálogo de ejercicios del usuario: los iniciales y los que añada. Se archivan en lugar de borrarse si están en uso.
CREATE TABLE exercise (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name         VARCHAR(80) NOT NULL,
    muscle_group VARCHAR(20) NOT NULL
        CHECK (muscle_group IN ('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'CORE', 'FULL_BODY', 'CARDIO')),
    type         VARCHAR(20) NOT NULL CHECK (type IN ('STRENGTH', 'BODYWEIGHT', 'TIMED', 'CARDIO')),
    equipment    VARCHAR(200),
    instructions VARCHAR(2000),
    safety       VARCHAR(1000),
    archived     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX exercise_name_uk ON exercise (user_id, lower(name));

-- Rutinas: lista ordenada de ejercicios con su objetivo y, opcionalmente, los días de la semana en que tocan.
CREATE TABLE routine (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name       VARCHAR(80) NOT NULL,
    notes      VARCHAR(1000),
    weekdays   VARCHAR(60),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX routine_name_uk ON routine (user_id, lower(name));

CREATE TABLE routine_exercise (
    id               UUID PRIMARY KEY,
    routine_id       UUID NOT NULL REFERENCES routine (id) ON DELETE CASCADE,
    exercise_id      UUID NOT NULL REFERENCES exercise (id),
    position         SMALLINT NOT NULL,
    sets             SMALLINT NOT NULL CHECK (sets BETWEEN 1 AND 20),
    reps_min         SMALLINT CHECK (reps_min BETWEEN 1 AND 200),
    reps_max         SMALLINT CHECK (reps_max BETWEEN 1 AND 200),
    weight_kg        NUMERIC(5, 2) CHECK (weight_kg BETWEEN 0 AND 500),
    duration_seconds INTEGER CHECK (duration_seconds BETWEEN 1 AND 86400),
    distance_km      NUMERIC(6, 2) CHECK (distance_km > 0 AND distance_km <= 1000),
    rest_seconds     SMALLINT CHECK (rest_seconds BETWEEN 0 AND 1800),
    notes            VARCHAR(500),
    CHECK (reps_max IS NULL OR reps_min IS NULL OR reps_max >= reps_min)
);

CREATE INDEX routine_exercise_routine_idx ON routine_exercise (routine_id);
CREATE INDEX routine_exercise_exercise_idx ON routine_exercise (exercise_id);
