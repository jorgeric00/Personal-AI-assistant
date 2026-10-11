-- Claves del servidor generadas automáticamente (por ejemplo las claves VAPID de las notificaciones push).
CREATE TABLE server_key (
    name       VARCHAR(50) PRIMARY KEY,
    value      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Un registro por navegador o dispositivo en el que se han activado las notificaciones.
CREATE TABLE push_subscription (
    id              UUID PRIMARY KEY,
    user_id         UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    endpoint        TEXT         NOT NULL UNIQUE,
    p256dh          VARCHAR(200) NOT NULL,
    auth            VARCHAR(100) NOT NULL,
    user_agent      VARCHAR(300),
    created_at      TIMESTAMPTZ  NOT NULL,
    last_success_at TIMESTAMPTZ
);

CREATE INDEX push_subscription_user_idx ON push_subscription (user_id);

-- Avisos ya enviados: la clave garantiza un único aviso por aparición aunque haya reintentos.
CREATE TABLE task_notification (
    task_id         UUID        NOT NULL REFERENCES task (id) ON DELETE CASCADE,
    occurrence_date DATE        NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (task_id, occurrence_date)
);
