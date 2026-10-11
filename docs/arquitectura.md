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
| Migraciones con Flyway, `ddl-auto: validate` | El esquema solo cambia con migraciones versionadas. |
| Pruebas de integración con Testcontainers | Se prueba contra PostgreSQL real, no contra una base de datos en memoria. |

## Suposiciones

- La app tiene un solo usuario (tú). El modelo de datos incluye `user_id` en las entidades para no cerrar la
  puerta a varios usuarios, pero no hay registro ni roles.
- Unidades métricas y euros por defecto.
- La interfaz solo está en español.

## Modelo de datos actual

| Tabla | Contenido |
| --- | --- |
| `app_user` | Cuenta: correo (único, sin distinguir mayúsculas), nombre visible, hash de la contraseña, fechas. |
| `spring_session`, `spring_session_attributes` | Sesiones activas. |

## Riesgos y temas abiertos

- **Despliegue.** Para usarla fuera de casa el servidor tiene que ser accesible desde el móvil y servirse por
  HTTPS (necesario para instalar la PWA, para las notificaciones y para la cookie `Secure`).
  Opciones: un VPS pequeño con Caddy, o un equipo en casa con Tailscale. Pendiente de decidir.
- **Notificaciones en iOS.** Solo funcionan con la app añadida a la pantalla de inicio y requieren claves VAPID
  y un proceso en el servidor que envíe los avisos. Se implementa en la fase 2.
- **Sin conexión.** Por ahora la app necesita conexión para ver y guardar datos. Un modo sin conexión con
  sincronización añadiría mucha complejidad; se valorará cuando haya módulos en uso.
- **Copias de seguridad.** Los datos viven en un volumen de Docker. Antes de usarla de verdad hay que
  programar copias de la base de datos (`pg_dump`).
