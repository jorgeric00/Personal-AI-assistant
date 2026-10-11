# Arquitectura y decisiones

## Visión general

```
Móvil / navegador ──HTTPS──▶ web (nginx: PWA + proxy /api) ──▶ backend (Spring Boot) ──▶ PostgreSQL
```

- **Un solo origen.** nginx sirve la app y reenvía `/api` al backend. Así la sesión va en una cookie
  `HttpOnly` y no hace falta CORS.
- **PWA.** La app se instala desde el navegador (Android e iOS) sin pasar por las tiendas. El service worker
  guarda la interfaz en caché para que abra al instante; los datos siempre se piden al servidor.
- **Backend por módulos.** Cada área funcional tendrá su paquete (`auth`, `user`, después `tasks`, `notes`,
  `finance`…) con su controlador, servicio, repositorio y DTOs. Lo compartido vive en `common`.

## Decisiones

| Decisión | Motivo |
| --- | --- |
| PWA en lugar de app nativa | Un único código para móvil y escritorio, instalación sin tiendas y notificaciones push en Android e iOS (16.4+, instalada en la pantalla de inicio). Si más adelante hace falta algo nativo (widgets, Salud), se puede envolver o migrar a React Native reutilizando la API. |
| Spring Boot 4.1 y Java 21 | Versiones estables con soporte largo. |
| Sesión en servidor (Spring Session JDBC) en lugar de JWT | Para un único usuario es más simple y seguro: cookie `HttpOnly`, cierre de sesión real y sesiones que sobreviven a reinicios. Duración: 30 días. |
| CSRF con cookie `XSRF-TOKEN` + cabecera `X-XSRF-TOKEN` | Protección estándar de Spring Security para SPAs. |
| Cuenta única creada al arrancar | La app es personal: no hay registro público. La cuenta se crea con variables de entorno si la base de datos está vacía y nunca se sobrescribe. |
| Contraseñas con BCrypt (`DelegatingPasswordEncoder`) | El prefijo `{bcrypt}` permite cambiar de algoritmo en el futuro sin romper cuentas. |
| Bloqueo tras 5 intentos fallidos durante 15 min | Protección básica frente a fuerza bruta si la app se expone a internet. |
| Fechas en UTC en la base de datos (`timestamptz`) y zona `Europe/Madrid` para mostrar | Evita errores con los cambios de hora. La zona del usuario viene de la configuración y se usa en el frontend. |
| Errores con `application/problem+json` (RFC 9457) | Formato estándar; los mensajes están en español y los errores de validación se devuelven por campo. |
| Internacionalización: español por defecto e inglés | En la app, i18next con los textos en `frontend/src/i18n/locales/` (el español es la referencia y TypeScript obliga a que el inglés tenga las mismas claves). En el servidor, `messages*.properties` según la cabecera `Accept-Language`, que la app envía siempre; una prueba comprueba que ambos ficheros tienen las mismas claves. El idioma elegido se guarda en la cuenta (`app_user.locale`) para usarlo también en lo que genera el servidor, como las notificaciones. Las fechas se formatean con `Intl` según el idioma. |
| Una tarea recurrente es una sola fila | `due_date` guarda la próxima ocurrencia pendiente y las completadas se registran en `task_completion` (clave `task_id` + fecha, así no hay duplicados). Las fechas se calculan con la regla (frecuencia, intervalo, días de la semana, hasta) a partir de `recurrence_anchor`. Si se completa una ocurrencia atrasada, la siguiente salta a hoy o después en lugar de acumular atrasos. Evita generar filas por adelantado y permite editar la regla sin reescribir el historial. |
| Tareas y recordatorios en la misma tabla (`kind`) | Comparten fecha, hora, repetición, categoría y aviso; los recordatorios no tienen fecha límite. |
| Notificaciones Web Push propias, sin servicios de terceros | El servidor cifra los mensajes (RFC 8291, `aes128gcm`) y los firma con VAPID (RFC 8292) usando solo la criptografía del JDK, sin dependencias extra. Las claves VAPID se pueden pasar por variables de entorno; si no, se generan al arrancar y se guardan en `server_key`. El contenido viaja cifrado de extremo a extremo hasta el dispositivo. |
| Envío de avisos con una tarea programada cada minuto | `ReminderNotifier` busca las ocurrencias cuyo aviso ya toca. Antes de enviar, inserta en `task_notification` (clave tarea + fecha), así cada ocurrencia se avisa una sola vez aunque haya varios procesos; si ningún dispositivo lo recibe, libera la marca para reintentar. Los avisos con más de 2 horas de retraso (por ejemplo, tras tener el servidor apagado) se descartan para no enviar ráfagas antiguas. Las suscripciones que el servicio push da por caducadas (404/410) se borran. |
| Migraciones con Flyway, `ddl-auto: validate` | El esquema solo cambia con migraciones versionadas. |
| Pruebas de integración con Testcontainers | Se prueba contra PostgreSQL real, no contra una base de datos en memoria. |

## Suposiciones

- La app tiene un solo usuario (tú). El modelo de datos incluye `user_id` en las entidades para no cerrar la
  puerta a varios usuarios, pero no hay registro ni roles.
- Unidades métricas y euros por defecto.
- Para añadir un idioma: crear `frontend/src/i18n/locales/<código>.ts` y `backend/src/main/resources/messages_<código>.properties`, y añadirlo a `SUPPORTED_LANGUAGES` y a `SupportedLocales`.

## Modelo de datos actual

| Tabla | Contenido |
| --- | --- |
| `app_user` | Cuenta: correo (único, sin distinguir mayúsculas), nombre visible, hash de la contraseña, idioma, fechas. |
| `spring_session`, `spring_session_attributes` | Sesiones activas. |
| `task_category` | Categorías de tareas del usuario: nombre (único sin distinguir mayúsculas) y color. |
| `task` | Tareas y recordatorios: tipo, título, descripción, fecha y hora, fecha límite, prioridad, estado (pendiente, aplazada, hecha), regla de repetición y minutos de antelación del aviso. |
| `task_completion` | Ocurrencias completadas de cada tarea, con la fecha de la ocurrencia y cuándo se completó. |
| `push_subscription` | Dispositivos con notificaciones activadas: endpoint del servicio push y claves públicas del navegador. |
| `task_notification` | Avisos ya enviados por tarea y ocurrencia, para no repetirlos. |
| `server_key` | Claves generadas por el servidor (VAPID). |

## Riesgos y temas abiertos

- **Despliegue.** Para usarla fuera de casa el servidor tiene que ser accesible desde el móvil y servirse por
  HTTPS (necesario para instalar la PWA, para las notificaciones y para la cookie `Secure`).
  Opciones: un VPS pequeño con Caddy, o un equipo en casa con Tailscale. Pendiente de decidir.
- **Notificaciones en iOS.** Solo funcionan con la app añadida a la pantalla de inicio (iOS 16.4 o posterior);
  la pantalla de Ajustes lo explica cuando detecta un iPhone sin instalar. Los avisos se envían por los
  servicios push de Apple, Google o Mozilla, que solo ven el mensaje cifrado.
- **Precisión de los avisos.** Se comprueban cada minuto, así que pueden llegar hasta un minuto tarde.
- **Sin conexión.** Por ahora la app necesita conexión para ver y guardar datos. Un modo sin conexión con
  sincronización añadiría mucha complejidad; se valorará cuando haya módulos en uso.
- **Copias de seguridad.** Los datos viven en un volumen de Docker. Antes de usarla de verdad hay que
  programar copias de la base de datos (`pg_dump`).
