-- Ajustes de finanzas por usuario. Se crean junto con las categorías iniciales la primera vez que se usa el módulo.
CREATE TABLE finance_settings (
    user_id    UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    currency   VARCHAR(3)   NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE finance_category (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    kind       VARCHAR(10) NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
    name       VARCHAR(50) NOT NULL,
    color      VARCHAR(20) NOT NULL,
    archived   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX finance_category_user_name_uk ON finance_category (user_id, kind, lower(name));

-- Cuenta o método de pago (efectivo, tarjeta, cuenta del banco…). Opcional en cada movimiento.
CREATE TABLE finance_account (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX finance_account_user_name_uk ON finance_account (user_id, lower(name));

-- Importes en céntimos (enteros) para evitar errores de redondeo. Siempre positivos: el tipo indica el signo.
CREATE TABLE finance_movement (
    id           UUID PRIMARY KEY,
    user_id      UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    kind         VARCHAR(10)  NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
    amount_cents BIGINT       NOT NULL CHECK (amount_cents > 0),
    currency     VARCHAR(3)    NOT NULL,
    date         DATE         NOT NULL,
    category_id  UUID         NOT NULL REFERENCES finance_category (id),
    account_id   UUID         REFERENCES finance_account (id) ON DELETE SET NULL,
    description  VARCHAR(200) NOT NULL DEFAULT '',
    search_text  TEXT         NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ  NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL
);

CREATE INDEX finance_movement_user_date_idx ON finance_movement (user_id, date DESC);
CREATE INDEX finance_movement_category_idx ON finance_movement (category_id);

CREATE TABLE finance_movement_tag (
    movement_id UUID        NOT NULL REFERENCES finance_movement (id) ON DELETE CASCADE,
    name        VARCHAR(40) NOT NULL,
    PRIMARY KEY (movement_id, name)
);
