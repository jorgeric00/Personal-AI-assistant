# LifeOS

Aplicación personal para organizar la vida fuera del trabajo: tareas, notas, finanzas, agenda, entrenamiento,
alimentación y evolución física. Pensada sobre todo para el móvil (se instala como app desde el navegador) y
usable también en el ordenador. Disponible en español (por defecto) e inglés.

La especificación completa del producto está en [docs/especificacion.md](docs/especificacion.md) y las decisiones
técnicas en [docs/arquitectura.md](docs/arquitectura.md).

## Estado

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1. Base | PWA instalable, inicio de sesión, Docker Compose, CI | ✅ |
| 2. Día a día | Tareas y recordatorios con notificaciones, notas, dashboard de hoy | ✅ |
| 3. Finanzas | Movimientos, presupuestos, resúmenes mensuales | Hecho ✅ (movimientos, categorías, cuentas, resumen, gráficos, ahorro, presupuestos con avisos, recurrentes y CSV) |
| 4. Entrenador personal | Entrenamientos, alimentación, evolución física, agenda y hábitos | En curso: perfil físico y evolución (peso, medidas, gráficos y comparación) ✅ · catálogo de ejercicios y rutinas ✅ · registro de entrenamientos, récords y constancia ✅ · agenda de actividades (día, semana y mes, solapamientos, plan frente a realizado) ✅ · diario de alimentación (comidas, agua, notas, comidas habituales, objetivos opcionales y resumen semanal) ✅ · plan semanal de comidas, preparación anticipada y lista de la compra ✅ · hábitos (diarios o semanales, historial y tendencia, sin rachas que castiguen) ✅ · objetivos personales con progreso real a partir de los registros ✅ · diario fotográfico privado con comparación entre fechas ✅ · indicadores propios (sueño, pulsaciones…) junto al peso y las medidas ✅ · informes por semana o mes con la cifra del periodo anterior ✅ |
| 6. Avisos y móvil | Notificaciones de agenda y hábitos, mejoras para el móvil | En curso: avisos antes de las actividades de la agenda ✅ · recordatorio diario opcional de hábitos ✅ |
| 5. Tus datos | Copias de seguridad, restauración y exportación completa | En curso: copias automáticas diarias con restauración documentada ✅ · descarga de todos tus datos en ZIP ✅ · borrado controlado por bloques ✅ |

## Arrancar con Docker (recomendado)

Necesitas Docker Desktop (o Docker Engine con el plugin Compose).

```bash
cp .env.example .env      # edita el fichero y pon tus contraseñas
docker compose up -d --build
```

Abre <http://localhost:8080> e inicia sesión con `LIFEOS_ADMIN_EMAIL` y `LIFEOS_ADMIN_PASSWORD`.
La cuenta se crea solo la primera vez que arranca la aplicación; después esas variables se ignoran.

Para parar: `docker compose down` (los datos se conservan en el volumen `db-data`).

Cada día se guarda una copia de la base de datos en `backups/`. Cómo restaurarla y cómo descargar tus datos:
[docs/copias-de-seguridad.md](docs/copias-de-seguridad.md).

## Desarrollo

Requisitos: Java 21, Node 22 y Docker.

```bash
# 1. Base de datos
LIFEOS_DB_PASSWORD=lifeos docker compose up -d db

# 2. Backend (http://localhost:8080)
cd backend
LIFEOS_ADMIN_EMAIL=yo@example.com LIFEOS_ADMIN_PASSWORD=una-contraseña-larga ./mvnw spring-boot:run

# 3. Frontend con recarga en caliente (http://localhost:5173, redirige /api al backend)
cd frontend
npm install
npm run dev
```

### Pruebas

```bash
cd backend && ./mvnw verify                  # unitarias + integración con PostgreSQL real (Testcontainers)
cd frontend && npm run lint && npm run typecheck && npm test
```

GitHub Actions ejecuta todo lo anterior y construye las imágenes Docker en cada pull request.

## Estructura

```
backend/    API REST · Java 21, Spring Boot 4, Spring Security, JPA, Flyway, PostgreSQL
frontend/   PWA · React 19, TypeScript, Vite, React Router, TanStack Query
docs/       Especificación y decisiones de arquitectura
docker-compose.yml
```
