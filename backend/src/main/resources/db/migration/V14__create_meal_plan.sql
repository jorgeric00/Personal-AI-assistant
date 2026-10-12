-- Planificación semanal de comidas. Lo planificado no cuenta como comido: solo pasa al diario cuando el usuario lo
-- registra (logged_at). Puede apuntar a una comida habitual (sus alimentos se copian al registrarla) o ser solo un
-- título. prep_date es el día en que se prepara con antelación (meal prep) y prepared, si ya está preparada.
CREATE TABLE planned_meal (
    id            UUID PRIMARY KEY,
    user_id       UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    date          DATE         NOT NULL,
    meal          VARCHAR(10)  NOT NULL CHECK (meal IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
    title         VARCHAR(120) NOT NULL,
    saved_meal_id UUID REFERENCES saved_meal (id) ON DELETE SET NULL,
    notes         VARCHAR(500),
    prep_date     DATE,
    prepared      BOOLEAN      NOT NULL DEFAULT FALSE,
    logged_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL,
    CONSTRAINT planned_meal_prep_before CHECK (prep_date IS NULL OR prep_date <= date)
);

CREATE INDEX planned_meal_user_date_idx ON planned_meal (user_id, date);
CREATE INDEX planned_meal_saved_meal_idx ON planned_meal (saved_meal_id);
