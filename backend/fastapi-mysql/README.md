# Backend 02 — FastAPI + MySQL

## 1. Project overview

A minimal REST API that demonstrates FastAPI + SQLAlchemy talking to a real MySQL database.
It exposes the three shared health endpoints used by every backend in the Technology Lab,
so any of the lab frontends can connect to it.

- Service name: `fastapi-mysql-api`
- API port: **8002**
- MySQL host port: **3306**

## 2. Technology stack

| Component | Version |
|-----------|---------|
| Python | 3.12 |
| FastAPI | 0.115 |
| Uvicorn | 0.34 |
| SQLAlchemy | 2.0 |
| PyMySQL (+ cryptography, for MySQL 8 authentication) | 1.1 |
| pydantic-settings | 2.9 |
| pytest + httpx | tests |
| MySQL | 8.4 (Docker, `mysql:8.4`) |

## Project structure

```
fastapi-mysql/
├── app/
│   ├── main.py            # application entry point, CORS, startup
│   ├── config.py          # environment configuration (.env)
│   ├── database.py        # engine, session lifecycle, startup retry, DB check
│   ├── models.py          # HealthRecord SQLAlchemy model
│   └── routers/
│       └── health.py      # /health, /health/app, /health/db
├── tests/test_health.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 3. Prerequisites

- Python 3.12+
- Docker Desktop (with Docker Compose v2)
- curl (optional, for testing)

## 4. Installation

```bash
cd backend/fastapi-mysql
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate        # Git Bash on Windows: source .venv/Scripts/activate

pip install -r requirements.txt
```

## 5. Environment configuration

```bash
cp .env.example .env
```

Edit `.env` and set `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD`. `.env` is git-ignored.
Real environment variables override values in `.env`.

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `8002` | Host port for the API container |
| `LOG_LEVEL` | `INFO` | Log level |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost:4200` | Allowed frontend origins |
| `MYSQL_DATABASE` | `technology_lab` | Database name |
| `MYSQL_USER` | `lab_user` | Application user |
| `MYSQL_PASSWORD` | — | Application user password (required) |
| `MYSQL_ROOT_PASSWORD` | — | Root password, used only by the container (required) |
| `MYSQL_HOST` | `127.0.0.1` | Database host |
| `MYSQL_PORT` | `3306` | Database port |
| `MYSQL_CONNECT_TIMEOUT` | `3` | Seconds for connect/read/write before failing |
| `DB_STARTUP_RETRIES` | `5` | Startup attempts to reach MySQL |
| `DB_STARTUP_RETRY_DELAY` | `2` | Seconds between startup attempts |

> Use `127.0.0.1` rather than `localhost`. On Windows, `localhost` can resolve to both IPv6 and
> IPv4, so when the database is down the timeout is paid twice.

## 6. Database setup

```bash
docker compose up -d mysql
docker compose ps            # wait for "(healthy)", about 20s on first start
```

The health check logs in as the application user (`mysqladmin ping`), so "healthy" means the API can really connect.

The `health_records` table is created automatically when the API starts:

| Column | Type |
|--------|------|
| `id` | INT, auto-increment primary key |
| `created_at` | DATETIME, default `now()` |

**Handling database startup delays:**

1. With Docker Compose, the `fastapi` service waits until the `mysql` health check passes.
2. On startup the API retries reaching MySQL (`DB_STARTUP_RETRIES` × `DB_STARTUP_RETRY_DELAY`).
3. If MySQL is still not reachable, the API **starts anyway**: `/health` returns 200, and the DB
   endpoints return 503. The table is then created on the first successful health check.
4. `pool_pre_ping` throws away connections broken by a MySQL restart, so recovery needs no API restart.

Stop and start the database:

```bash
docker compose stop mysql       # stop (data is kept)
docker compose start mysql
docker compose down          # remove containers (volume kept)
docker compose down -v       # also delete the mysql_data volume
```

## 7. Running the application

**Local development:**

```bash
uvicorn app.main:app --reload --port 8002
```

Interactive docs: http://localhost:8002/docs

**Fully containerised (API + database):**

```bash
docker compose up -d --build
docker compose logs -f fastapi
docker compose down
```

## 8. API endpoints

| Method | Endpoint | Description | Success | Failure |
|--------|----------|-------------|---------|---------|
| GET | `/health` | API process is running. Does **not** touch the database. | 200 | — |
| GET | `/health/app` | Application health, including MySQL status | 200 | 503 |
| GET | `/health/db` | Runs `SELECT 1` plus a read of `health_records` | 200 | 503 |

**GET /health** → `200`
```json
{"status": "healthy", "service": "fastapi-mysql-api"}
```

**GET /health/app** → `200` / `503`
```json
{"status": "healthy", "service": "fastapi-mysql-api", "database": {"status": "healthy", "type": "mysql"}}
```
```json
{"status": "unhealthy", "service": "fastapi-mysql-api", "database": {"status": "unhealthy", "type": "mysql"}}
```

**GET /health/db** → `200` / `503`
```json
{"status": "healthy", "database": "mysql", "message": "Database connection successful"}
```
```json
{"status": "unhealthy", "database": "mysql", "message": "Database connection failed"}
```

Health checks only read, so they never insert records. Responses never contain credentials,
and failures are logged with the exception type only.

## 9. Testing

**Automated tests.** These need MySQL running.

```bash
python -m pytest -v
```

They cover all three endpoints, health checks not creating records, HealthRecord create/read/delete
(the test cleans up after itself), the database being unreachable (503s while `/health` stays 200),
and CORS.

**Manual curl checks:**

```bash
curl -i http://localhost:8002/health
curl -i http://localhost:8002/health/app
curl -i http://localhost:8002/health/db
curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" http://localhost:8002/health | grep -i access-control
```

**Failure scenarios:**

| Scenario | How | Expected |
|----------|-----|----------|
| DB stopped | `docker compose stop mysql` | `/health` 200, DB endpoints 503 after about 2s |
| DB restored | `docker compose start mysql` | 200 again with no API restart |
| Invalid credentials | wrong `MYSQL_PASSWORD` in `.env`, restart the API | 503 |
| Connection timeout | `MYSQL_HOST=10.255.255.1` | 503 after `MYSQL_CONNECT_TIMEOUT` seconds |
| API started before DB | stop the DB, start the API, then start the DB | API starts; DB endpoints are 503, then 200 once MySQL is up |

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| `RuntimeError: 'cryptography' package is required` | Run `pip install -r requirements.txt` (MySQL 8 uses `caching_sha2_password`). |
| `Access denied for user 'lab_user'` after changing `.env` | MySQL reads users and passwords only when it first creates the volume. Run `docker compose down -v` and start again (this deletes the data). |
| DB container stays `starting` | The first start takes about 20–30s. Check `docker compose logs mysql`. |
| `Can't connect to MySQL server` | Check `docker compose ps`, and that `MYSQL_PORT` matches the published port. |
| Port 3306 already in use | Another MySQL is running. Set `MYSQL_PORT=3307` in `.env` and run `docker compose up -d mysql` again. |
| Browser shows a CORS error | Add the origin to `CORS_ALLOWED_ORIGINS` and restart. |
| Port 8002 in use | Run `docker compose stop fastapi`, or stop the other process. |
