-- Presupuesto mensual por categoría de gastos (el mismo límite cada mes).
CREATE TABLE finance_budget (
    id           UUID PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    category_id  UUID        NOT NULL UNIQUE REFERENCES finance_category (id) ON DELETE CASCADE,
    amount_cents BIGINT      NOT NULL CHECK (amount_cents > 0),
    created_at   TIMESTAMPTZ NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL
);

-- Avisos de presupuesto ya enviados: uno por presupuesto, mes y nivel (cerca del límite o superado).
CREATE TABLE finance_budget_alert (
    budget_id UUID        NOT NULL REFERENCES finance_budget (id) ON DELETE CASCADE,
    month     VARCHAR(7)  NOT NULL,
    level     VARCHAR(10) NOT NULL CHECK (level IN ('WARNING', 'EXCEEDED')),
    sent_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (budget_id, month, level)
);

-- Ingresos y gastos que se repiten. Cada aparición se genera una sola vez como movimiento normal:
-- next_index cuenta las ya generadas y la clave única (recurring_id, occurrence_date) impide duplicados.
CREATE TABLE finance_recurring (
    id           UUID PRIMARY KEY,
    user_id      UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    kind         VARCHAR(10)  NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
    amount_cents BIGINT       NOT NULL CHECK (amount_cents > 0),
    currency     VARCHAR(3)   NOT NULL,
    category_id  UUID         NOT NULL REFERENCES finance_category (id),
    account_id   UUID         REFERENCES finance_account (id) ON DELETE SET NULL,
    description  VARCHAR(200) NOT NULL DEFAULT '',
    frequency    VARCHAR(10)  NOT NULL CHECK (frequency IN ('WEEKLY', 'MONTHLY', 'YEARLY')),
    every_n      INT          NOT NULL CHECK (every_n BETWEEN 1 AND 12),
    start_date   DATE         NOT NULL,
    until_date   DATE,
    next_index   INT          NOT NULL DEFAULT 0,
    next_date    DATE,
    created_at   TIMESTAMPTZ  NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL
);

CREATE INDEX finance_recurring_next_idx ON finance_recurring (next_date) WHERE next_date IS NOT NULL;

ALTER TABLE finance_movement
    ADD COLUMN recurring_id    UUID REFERENCES finance_recurring (id) ON DELETE SET NULL,
    ADD COLUMN occurrence_date DATE;

CREATE UNIQUE INDEX finance_movement_occurrence_uk ON finance_movement (recurring_id, occurrence_date)
    WHERE recurring_id IS NOT NULL;
