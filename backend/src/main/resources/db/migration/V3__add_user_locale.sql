-- Idioma preferido del usuario (es, en). Se usa también en lo que genera el servidor, como las notificaciones.
ALTER TABLE app_user ADD COLUMN locale VARCHAR(10) NOT NULL DEFAULT 'es';
