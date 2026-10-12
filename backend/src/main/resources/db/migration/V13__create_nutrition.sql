-- Objetivos de alimentación que el usuario fija y cambia cuando quiere. Todos opcionales; la app no los calcula.
CREATE TABLE nutrition_target (
    user_id    UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    calories   INT CHECK (calories BETWEEN 1 AND 10000),
    protein_g  NUMERIC(5, 1) CHECK (protein_g BETWEEN 0 AND 1000),
    carbs_g    NUMERIC(5, 1) CHECK (carbs_g BETWEEN 0 AND 1000),
    fat_g      NUMERIC(5, 1) CHECK (fat_g BETWEEN 0 AND 1000),
    water_ml   INT CHECK (water_ml BETWEEN 1 AND 10000),
    updated_at TIMESTAMPTZ NOT NULL
);

-- Agua y notas de cada comida de un día.
CREATE TABLE nutrition_day (
    user_id         UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    water_ml        INT  NOT NULL DEFAULT 0 CHECK (water_ml BETWEEN 0 AND 20000),
    breakfast_note  VARCHAR(1000),
    lunch_note      VARCHAR(1000),
    dinner_note     VARCHAR(1000),
    snack_note      VARCHAR(1000),
    updated_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, date)
);

-- Alimentos registrados. Cantidad y nutrientes son opcionales: solo se guarda lo que el usuario sabe o quiere anotar.
-- estimated marca que los nutrientes son una estimación y no un dato confirmado (etiqueta, báscula…).
CREATE TABLE food_entry (
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    date       DATE         NOT NULL,
    meal       VARCHAR(10)  NOT NULL CHECK (meal IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
    name       VARCHAR(120) NOT NULL,
    quantity   NUMERIC(7, 2) CHECK (quantity > 0 AND quantity <= 99999),
    unit       VARCHAR(20),
    calories   INT CHECK (calories BETWEEN 0 AND 10000),
    protein_g  NUMERIC(5, 1) CHECK (protein_g BETWEEN 0 AND 1000),
    carbs_g    NUMERIC(5, 1) CHECK (carbs_g BETWEEN 0 AND 1000),
    fat_g      NUMERIC(5, 1) CHECK (fat_g BETWEEN 0 AND 1000),
    estimated  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX food_entry_user_date_idx ON food_entry (user_id, date);

-- Comidas habituales: una lista de alimentos que se añade de una vez a un día.
CREATE TABLE saved_meal (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name       VARCHAR(80) NOT NULL,
    meal       VARCHAR(10) CHECK (meal IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX saved_meal_name_uk ON saved_meal (user_id, lower(name));

CREATE TABLE saved_meal_item (
    id            UUID PRIMARY KEY,
    saved_meal_id UUID         NOT NULL REFERENCES saved_meal (id) ON DELETE CASCADE,
    position      SMALLINT     NOT NULL,
    name          VARCHAR(120) NOT NULL,
    quantity      NUMERIC(7, 2) CHECK (quantity > 0 AND quantity <= 99999),
    unit          VARCHAR(20),
    calories      INT CHECK (calories BETWEEN 0 AND 10000),
    protein_g     NUMERIC(5, 1) CHECK (protein_g BETWEEN 0 AND 1000),
    carbs_g       NUMERIC(5, 1) CHECK (carbs_g BETWEEN 0 AND 1000),
    fat_g         NUMERIC(5, 1) CHECK (fat_g BETWEEN 0 AND 1000),
    estimated     BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX saved_meal_item_meal_idx ON saved_meal_item (saved_meal_id);
