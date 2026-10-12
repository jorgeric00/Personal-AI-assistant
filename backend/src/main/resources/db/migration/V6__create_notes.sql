-- Notas. search_text guarda título, contenido y etiquetas en minúsculas y sin tildes para buscar sin
-- depender de extensiones de PostgreSQL.
CREATE TABLE note (
    id          UUID PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL DEFAULT '',
    body        TEXT         NOT NULL DEFAULT '',
    state       VARCHAR(10)  NOT NULL CHECK (state IN ('ACTIVE', 'ARCHIVED', 'TRASHED')),
    pinned      BOOLEAN      NOT NULL DEFAULT FALSE,
    favorite    BOOLEAN      NOT NULL DEFAULT FALSE,
    search_text TEXT         NOT NULL DEFAULT '',
    trashed_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL,
    CONSTRAINT note_trashed_at CHECK ((state = 'TRASHED') = (trashed_at IS NOT NULL))
);

CREATE INDEX note_user_state_idx ON note (user_id, state, updated_at DESC);

-- Etiquetas libres, guardadas en minúsculas.
CREATE TABLE note_tag (
    note_id UUID        NOT NULL REFERENCES note (id) ON DELETE CASCADE,
    name    VARCHAR(40) NOT NULL,
    PRIMARY KEY (note_id, name)
);

CREATE INDEX note_tag_name_idx ON note_tag (name);

-- Tareas relacionadas con una nota. Cuando existan objetivos o actividades se añadirán tablas equivalentes.
CREATE TABLE note_task (
    note_id UUID NOT NULL REFERENCES note (id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES task (id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, task_id)
);

CREATE INDEX note_task_task_idx ON note_task (task_id);
