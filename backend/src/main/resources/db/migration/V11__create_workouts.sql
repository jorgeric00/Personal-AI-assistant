-- Entrenamientos: los empezados desde una rutina o libres, en curso (finished_at nulo) o terminados.
-- Solo cuentan como hechas las series marcadas como tales; planificar una sesión no la da por hecha.
CREATE TABLE workout (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    routine_id  UUID REFERENCES routine (id) ON DELETE SET NULL,
    name        VARCHAR(80) NOT NULL,
    date        DATE NOT NULL,
    finished_at TIMESTAMPTZ,
    effort      SMALLINT CHECK (effort BETWEEN 1 AND 10),
    notes       VARCHAR(2000),
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX workout_user_date_idx ON workout (user_id, date DESC);

-- Ejercicio dentro de un entrenamiento, con el objetivo copiado de la rutina en el momento de empezar.
CREATE TABLE workout_exercise (
    id                      UUID PRIMARY KEY,
    workout_id              UUID NOT NULL REFERENCES workout (id) ON DELETE CASCADE,
    exercise_id             UUID NOT NULL REFERENCES exercise (id),
    position                SMALLINT NOT NULL,
    target_sets             SMALLINT CHECK (target_sets BETWEEN 1 AND 20),
    target_reps_min         SMALLINT CHECK (target_reps_min BETWEEN 1 AND 200),
    target_reps_max         SMALLINT CHECK (target_reps_max BETWEEN 1 AND 200),
    target_weight_kg        NUMERIC(5, 2) CHECK (target_weight_kg BETWEEN 0 AND 500),
    target_duration_seconds INTEGER CHECK (target_duration_seconds BETWEEN 1 AND 86400),
    target_distance_km      NUMERIC(6, 2) CHECK (target_distance_km > 0 AND target_distance_km <= 1000),
    rest_seconds            SMALLINT CHECK (rest_seconds BETWEEN 0 AND 1800),
    notes                   VARCHAR(500)
);

CREATE INDEX workout_exercise_workout_idx ON workout_exercise (workout_id);
CREATE INDEX workout_exercise_exercise_idx ON workout_exercise (exercise_id);

CREATE TABLE workout_set (
    id                  UUID PRIMARY KEY,
    workout_exercise_id UUID NOT NULL REFERENCES workout_exercise (id) ON DELETE CASCADE,
    position            SMALLINT NOT NULL,
    reps                SMALLINT CHECK (reps BETWEEN 0 AND 1000),
    weight_kg           NUMERIC(5, 2) CHECK (weight_kg BETWEEN 0 AND 500),
    duration_seconds    INTEGER CHECK (duration_seconds BETWEEN 1 AND 86400),
    distance_km         NUMERIC(6, 2) CHECK (distance_km > 0 AND distance_km <= 1000),
    done                BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX workout_set_exercise_idx ON workout_set (workout_exercise_id);
