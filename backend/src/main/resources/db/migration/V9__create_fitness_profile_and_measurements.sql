-- Perfil físico: todos los campos son opcionales; no se asume nada del usuario.
CREATE TABLE fitness_profile (
    user_id          UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    birth_date       DATE,
    height_cm        NUMERIC(4, 1) CHECK (height_cm BETWEEN 50 AND 260),
    start_weight_kg  NUMERIC(5, 2) CHECK (start_weight_kg BETWEEN 20 AND 400),
    goal             VARCHAR(20) CHECK (goal IN ('LOSE_FAT', 'GAIN_MUSCLE', 'MAINTAIN', 'ENDURANCE', 'CUSTOM')),
    goal_details     VARCHAR(500),
    activity_level   VARCHAR(20) CHECK (activity_level IN ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE')),
    experience       VARCHAR(20) CHECK (experience IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    days_per_week    SMALLINT CHECK (days_per_week BETWEEN 0 AND 7),
    minutes_per_session SMALLINT CHECK (minutes_per_session BETWEEN 5 AND 600),
    food_preferences VARCHAR(1000),
    food_avoid       VARCHAR(1000),
    equipment        VARCHAR(1000),
    notes            VARCHAR(2000),
    updated_at       TIMESTAMPTZ NOT NULL
);

-- Registros de evolución: uno por día como máximo, con los valores que se quieran anotar.
CREATE TABLE body_measurement (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    date         DATE NOT NULL,
    weight_kg    NUMERIC(5, 2) CHECK (weight_kg BETWEEN 20 AND 400),
    body_fat_pct NUMERIC(4, 1) CHECK (body_fat_pct BETWEEN 2 AND 70),
    waist_cm     NUMERIC(4, 1) CHECK (waist_cm BETWEEN 10 AND 300),
    chest_cm     NUMERIC(4, 1) CHECK (chest_cm BETWEEN 10 AND 300),
    hip_cm       NUMERIC(4, 1) CHECK (hip_cm BETWEEN 10 AND 300),
    arm_cm       NUMERIC(4, 1) CHECK (arm_cm BETWEEN 10 AND 300),
    thigh_cm     NUMERIC(4, 1) CHECK (thigh_cm BETWEEN 10 AND 300),
    notes        VARCHAR(1000),
    created_at   TIMESTAMPTZ NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT body_measurement_date_uk UNIQUE (user_id, date)
);
