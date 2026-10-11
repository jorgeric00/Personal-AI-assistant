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
| 3. Finanzas | Movimientos, presupuestos, resúmenes mensuales | Pendiente |
| 4. Entrenador personal | Entrenamientos, alimentación, evolución física, agenda y hábitos | Pendiente |

## Arrancar con Docker (recomendado)

Necesitas Docker Desktop (o Docker Engine con el plugin Compose).

```bash
cp .env.example .env      # edita el fichero y pon tus contraseñas
docker compose up -d --build
```

Abre <http://localhost:8080> e inicia sesión con `LIFEOS_ADMIN_EMAIL` y `LIFEOS_ADMIN_PASSWORD`.
La cuenta se crea solo la primera vez que arranca la aplicación; después esas variables se ignoran.

Para parar: `docker compose down` (los datos se conservan en el volumen `db-data`).

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
