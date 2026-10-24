# Copias de seguridad, restauración y exportación

LifeOS guarda todo (también las fotos de progreso) en la base de datos PostgreSQL, dentro del volumen de Docker
`db-data`. Hay dos formas de conservar los datos:

| | Copia de seguridad | Exportación de tus datos |
| --- | --- | --- |
| Para qué | Recuperar la app tal como estaba (por error, disco roto o cambio de equipo) | Llevarte tus datos o consultarlos con otras herramientas |
| Qué es | Un volcado completo de la base de datos (`.dump`) | Un ZIP con `datos.json`, `finanzas.csv` y las fotos en JPEG |
| Cómo se hace | Automática, cada 24 horas, en la carpeta `backups/` | Ajustes → Tus datos → Descargar mis datos |
| Cómo se recupera | Con `pg_restore` (abajo) | Se lee con cualquier programa; los movimientos se pueden importar en Finanzas |

> Las dos contienen datos personales y sensibles (medidas, fotos, finanzas). Guárdalas en un sitio seguro y no
> las compartas. La carpeta `backups/` nunca se sube al repositorio.

Los comandos de esta guía son iguales en PowerShell (Windows), en macOS y en Linux. Ejecútalos en la carpeta del
proyecto, donde está `docker-compose.yml`.

## Copias automáticas

El servicio `backup` de `docker-compose.yml` arranca con el resto de la app. Hace una copia al arrancar y después
una cada `LIFEOS_BACKUP_INTERVAL_HOURS` horas (24 por defecto), y conserva las `LIFEOS_BACKUP_KEEP` más recientes
(14 por defecto); las más antiguas se borran solas. Las copias quedan en `backups/` con nombres como
`lifeos-20261024-030000.dump`.

Para ver que funciona:

```sh
docker compose logs backup
```

Cada copia aparece como `Copia guardada: lifeos-….dump`. Si una falla, se escribe `ERROR` y se reintenta en el
siguiente turno; la copia a medias no se queda en la carpeta.

**Importante:** una copia en el mismo disco no te protege si el disco se rompe o pierdes el equipo. Copia de vez
en cuando el `.dump` más reciente a otro sitio (un disco externo o una nube en la que confíes).

## Copia manual

Por ejemplo, antes de actualizar la app:

```sh
docker compose exec db pg_dump -U lifeos -d lifeos --format=custom --file=/tmp/manual.dump
docker compose cp db:/tmp/manual.dump ./backups/lifeos-manual.dump
docker compose exec db rm /tmp/manual.dump
```

(No uses `pg_dump … > fichero` en PowerShell: la redirección cambia los bytes y estropea la copia.)

## Restaurar una copia

La restauración **sustituye todos los datos actuales** por los de la copia. Si dudas, haz antes una copia manual.

1. Para la app y las copias automáticas, dejando la base de datos en marcha:

   ```sh
   docker compose stop web backend backup
   ```

2. Pasa la copia al contenedor de la base de datos y restáurala (cambia el nombre por el de tu copia):

   ```sh
   docker compose cp ./backups/lifeos-20261024-030000.dump db:/tmp/restore.dump
   docker compose exec db pg_restore -U lifeos -d lifeos --clean --if-exists --no-owner /tmp/restore.dump
   docker compose exec db rm /tmp/restore.dump
   ```

3. Vuelve a arrancarlo todo:

   ```sh
   docker compose up -d
   ```

4. Entra en la app y comprueba que ves tus datos de la fecha de la copia. Las sesiones abiertas después de esa
   fecha se cierran, así que puede que tengas que volver a iniciar sesión.

### En un equipo nuevo

1. Clona el repositorio y crea el `.env` (puedes poner una contraseña de base de datos nueva).
2. Arranca solo la base de datos: `docker compose up -d db`.
3. Sigue el paso 2 de arriba con tu copia y después `docker compose up -d`. Tu usuario y contraseña son los de la
   copia; `LIFEOS_ADMIN_*` no se usa porque ya existe un usuario.

Si la app es de una versión más nueva que la copia, al arrancar aplica sola los cambios de la base de datos
pendientes (Flyway). No restaures una copia hecha con una versión más nueva de la app en una más antigua.

## Exportación de tus datos

En **Ajustes → Tus datos → Descargar mis datos** se descarga `lifeos-AAAA-MM-DD.zip` con:

- `datos.json`: todos tus datos, una lista por tabla (tareas, notas, finanzas, entrenos, medidas, alimentación,
  agenda, hábitos, objetivos…). Las fechas van en formato ISO 8601, los momentos en UTC y los importes en
  céntimos. No incluye tu contraseña, las sesiones ni las claves de las notificaciones de cada navegador.
- `finanzas.csv`: tus movimientos en el mismo formato que lee **Finanzas → Importar CSV**.
- `fotos/`: tus fotos de progreso en JPEG (ya sin metadatos). El campo `file` de cada foto en `datos.json` indica
  su fichero.

El servidor no guarda la exportación: se genera al pedirla y solo la puede descargar quien ha iniciado sesión.
