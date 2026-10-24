-- Indicadores propios para la evolución física (pulsaciones en reposo, horas de sueño, energía…). Cada registro de
-- evolución puede anotar un valor de cualquiera de ellos; archivar un indicador lo oculta del formulario sin perder
-- su historial, y borrarlo borra también sus valores.
CREATE TABLE custom_metric (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name       VARCHAR(40) NOT NULL,
    unit       VARCHAR(12),
    decimals   SMALLINT    NOT NULL CHECK (decimals BETWEEN 0 AND 2),
    archived   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX custom_metric_name_uk ON custom_metric (user_id, lower(name));

CREATE TABLE custom_metric_value (
    measurement_id UUID          NOT NULL REFERENCES body_measurement (id) ON DELETE CASCADE,
    metric_id      UUID          NOT NULL REFERENCES custom_metric (id) ON DELETE CASCADE,
    value          NUMERIC(9, 2) NOT NULL CHECK (value BETWEEN -1000000 AND 1000000),
    PRIMARY KEY (measurement_id, metric_id)
);

CREATE INDEX custom_metric_value_metric_idx ON custom_metric_value (metric_id);
