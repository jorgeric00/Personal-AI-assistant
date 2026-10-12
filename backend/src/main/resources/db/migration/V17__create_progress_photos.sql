-- Diario fotográfico privado. Los metadatos y las imágenes van en tablas separadas para que listar la galería no
-- lea los bytes. Las imágenes se guardan en la propia base de datos: así quedan dentro de las copias de seguridad
-- (pg_dump) y solo se sirven a su dueño a través de la API, nunca como ficheros públicos.
CREATE TABLE progress_photo (
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    taken_on   DATE         NOT NULL,
    pose       VARCHAR(5)   NOT NULL CHECK (pose IN ('FRONT', 'SIDE', 'BACK', 'OTHER')),
    notes      VARCHAR(500),
    width      INTEGER      NOT NULL CHECK (width > 0),
    height     INTEGER      NOT NULL CHECK (height > 0),
    created_at TIMESTAMPTZ  NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX progress_photo_user_date_idx ON progress_photo (user_id, taken_on DESC);

-- La imagen reducida (como mucho 2048 px de lado) y la miniatura, ambas en JPEG y sin metadatos (ni GPS ni EXIF).
CREATE TABLE progress_photo_data (
    photo_id  UUID PRIMARY KEY REFERENCES progress_photo (id) ON DELETE CASCADE,
    image     BYTEA NOT NULL,
    thumbnail BYTEA NOT NULL
);
