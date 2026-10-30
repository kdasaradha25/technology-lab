# Backend 01 — Django + PostgreSQL

## 1. Project overview

A minimal REST API that demonstrates Django + Django REST Framework talking to a real
PostgreSQL database. It exposes the three shared health endpoints used by every
backend in the Technology Lab, so any of the lab frontends can connect to it.

- Service name: `django-postgres-api`
- API port: **8001**
- PostgreSQL host port: **5433** (5433 rather than 5432, so it doesn't clash with a locally installed PostgreSQL)

## 2. Technology stack

| Component | Version |
|-----------|---------|
| Python | 3.12 |
| Django | 5.2 |
| Django REST Framework | 3.16 |
| django-cors-headers | 4.9 |
| psycopg | 3.2 (binary) |
| python-dotenv | 1.1 |
| gunicorn (container only) | 23 |
| PostgreSQL | 17 (Docker, `postgres:17-alpine`) |

## 3. Prerequisites

- Python 3.12+
- Docker Desktop (with Docker Compose v2)
- curl (optional, for testing)

## 4. Installation

```bash
cd backend/django-postgres
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# macOS / Linux / Git Bash
source .venv/bin/activate        # Git Bash on Windows: source .venv/Scripts/activate

pip install -r requirements.txt
```

## 5. Environment configuration

```bash
cp .env.example .env
```

Then edit `.env` and set at least `POSTGRES_PASSWORD` and `DJANGO_SECRET_KEY`.
`.env` is git-ignored; never commit it.

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | — | Django secret key |
| `DJANGO_DEBUG` | `False` | Debug mode |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated hosts |
| `API_PORT` | `8001` | Host port for the API container |
| `LOG_LEVEL` | `INFO` | Root log level |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost:4200` | Allowed frontend origins |
| `POSTGRES_DB` | `technology_lab` | Database name |
| `POSTGRES_USER` | `lab_user` | Database user |
| `POSTGRES_PASSWORD` | — | Database password (required) |
| `POSTGRES_HOST` | `127.0.0.1` | Database host |
| `POSTGRES_PORT` | `5433` | Database port on the host |
| `POSTGRES_CONNECT_TIMEOUT` | `3` | Seconds before a connection attempt fails |

> Use `127.0.0.1` rather than `localhost`. On Windows, `localhost` resolves to both `::1` and
> `127.0.0.1`, so when the database is down the timeout is paid twice.

## 6. Database setup

Start PostgreSQL (it uses the values from `.env`):

```bash
docker compose up -d postgres
docker compose ps            # wait until STATUS shows "(healthy)"
```

Apply migrations (this creates the `health_healthrecord` table):

```bash
python manage.py migrate
python manage.py showmigrations health     # [X] 0001_initial
```

Stop and start the database:

```bash
docker compose stop postgres       # stop (data is kept)
docker compose start postgres      # start again
docker compose down          # remove containers (data volume is kept)
docker compose down -v       # remove containers AND the postgres_data volume
```

Data is stored in the named volume `django-postgres_postgres_data`.

### Model

`HealthRecord` has two fields: `id` (BigAutoField) and `created_at` (set automatically).
The health checks only **read** from this table, so they never create records.
Writes are verified by the test suite and the shell command in section 9.

## 7. Running the application

**Local development server:**

```bash
python manage.py runserver 8001
```

**Fully containerised (API + database):**

```bash
docker compose up -d --build
docker compose logs -f django
docker compose down
```

The API container runs `migrate` on startup and then serves the app with gunicorn on port 8001.
It starts only after the PostgreSQL health check passes.

## 8. API endpoints

| Method | Endpoint | Description | Success | Failure |
|--------|----------|-------------|---------|---------|
| GET | `/health` | API process is running. Does **not** touch the database. | 200 | — |
| GET | `/health/app` | Application health, including PostgreSQL status | 200 | 503 |
| GET | `/health/db` | Runs `SELECT 1` plus a read of `HealthRecord` | 200 | 503 |

**GET /health** → `200`
```json
{"status": "healthy", "service": "django-postgres-api"}
```

**GET /health/app** → `200` / `503`
```json
{"status": "healthy", "service": "django-postgres-api", "database": {"status": "healthy", "type": "postgresql"}}
```
```json
{"status": "unhealthy", "service": "django-postgres-api", "database": {"status": "unhealthy", "type": "postgresql"}}
```

**GET /health/db** → `200` / `503`
```json
{"status": "healthy", "database": "postgresql", "message": "Database connection successful"}
```
```json
{"status": "unhealthy", "database": "postgresql", "message": "Database connection failed"}
```

Responses never contain credentials or driver error messages. Failures are logged as a warning
that names only the exception type.

## 9. Testing

**Automated tests.** These need PostgreSQL running; Django creates and destroys a `test_technology_lab` database.

```bash
python manage.py test -v 2
```

They cover: writing and reading `HealthRecord`, all three endpoints, health checks not
creating records, the database-unavailable case (503s while `/health` stays 200), and CORS.

**Manual curl checks:**

```bash
curl -i http://localhost:8001/health
curl -i http://localhost:8001/health/app
curl -i http://localhost:8001/health/db

# CORS
curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" http://localhost:8001/health | grep -i access-control
```

**Read/write against the real database:**

```bash
python manage.py shell -c "from health.models import HealthRecord as H; r=H.objects.create(); print(H.objects.get(pk=r.pk).created_at); r.delete()"
```

**Failure scenarios:**

| Scenario | How | Expected |
|----------|-----|----------|
| DB stopped | `docker compose stop postgres` | `/health` 200, `/health/app` and `/health/db` 503 after about 3s |
| DB restored | `docker compose start postgres` | all endpoints 200 on the next request (no API restart needed) |
| Invalid credentials | set a wrong `POSTGRES_PASSWORD` in `.env`, restart the API | 503 on `/health/app` and `/health/db` |
| Connection timeout | `POSTGRES_HOST=10.255.255.1` | 503 after `POSTGRES_CONNECT_TIMEOUT` seconds |
| API stopped | stop runserver | client gets connection refused |

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| `password authentication failed for user "lab_user"` on port 5432 | Another PostgreSQL is listening on 5432. This project uses 5433; check that `POSTGRES_PORT=5433` is set in `.env`. |
| Password changed in `.env` but the DB still rejects it | PostgreSQL reads the password only when it first creates the volume. Run `docker compose down -v` and start again (this deletes the data). |
| `/health/db` returns 503 and logs `ProgrammingError` | Migrations haven't been applied. Run `python manage.py migrate`. |
| `failed to connect to the docker API` | Start Docker Desktop. |
| Browser shows a CORS error | Add the frontend origin to `CORS_ALLOWED_ORIGINS` and restart. |
| `DisallowedHost` / HTTP 400 | Add the hostname to `DJANGO_ALLOWED_HOSTS`. |
| Port 8001 already in use | Stop the other process, or run `docker compose stop django` if the container is running. |
