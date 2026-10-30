# Backend 06 — Python Standard Library + Redis + InfluxDB

## 1. Project overview

A minimal HTTP API built only on Python's standard library (`http.server`), with no Django,
FastAPI or Flask. It checks two different databases: **Redis** (in-memory key-value) and
**InfluxDB** (time-series). The database drivers are the only third-party packages.

It exposes the three shared health endpoints used by every backend in the Technology Lab.
Because two databases are involved, the `database` field is extended with a per-database breakdown.

- Service name: `python-stdlib-redis-influxdb-api`
- API port: **8006**
- Redis: **6379**, InfluxDB: **8086**

## 2. Technology stack

| Component | Version |
|-----------|---------|
| Python | 3.12+ |
| HTTP server | `http.server.ThreadingHTTPServer` (standard library) |
| Redis client | `redis` 5.2.1 |
| InfluxDB client | `influxdb-client` 1.48.0 (official, for InfluxDB 2.x) |
| Redis | 7.4 (Docker, `redis:7.4-alpine`, AOF persistence, password required) |
| InfluxDB | 2.7 (Docker, `influxdb:2.7`) |
| Tests | `unittest` (standard library) |

## Project structure

```
python-stdlib-redis-influxdb/
├── app/
│   ├── main.py              # HTTP server, routing, CORS, graceful shutdown
│   ├── config.py            # environment configuration + .env loader
│   ├── health.py            # health-check logic (both databases checked in parallel)
│   ├── redis_client.py      # Redis connection + PING
│   ├── influxdb_client.py   # InfluxDB connection + bucket lookup
│   └── database_setup.py    # write/read verification utilities (run on demand)
├── tests/test_app.py
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

> **Why the modules are in an `app/` package:** the required file name `influxdb_client.py`
> is also the import name of the `influxdb-client` library. Inside a package, `import influxdb_client`
> still finds the real library. **Always start with `python -m app.main`.** Running
> `python app/main.py` would put `app/` on `sys.path`, and the file would shadow the library.

## 3. Prerequisites

- Python 3.12 or newer
- Docker Desktop (with Docker Compose v2)
- curl (optional)

## 4. Installation

```bash
cd backend/python-stdlib-redis-influxdb
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

Set `REDIS_PASSWORD`, `INFLUXDB_TOKEN` and `INFLUXDB_ADMIN_PASSWORD` in `.env`. `.env` is git-ignored;
real environment variables override it.

> **Use secrets that don't start with `-`.** InfluxDB's first-time setup passes them as
> command-line arguments, and a leading dash is read as an option, so setup fails with
> `unknown command ... for "setup"`. Hex strings are safe:
> `python -c "import secrets; print(secrets.token_hex(32))"`.

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `8006` | API port |
| `LOG_LEVEL` | `INFO` | Log level |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost:4200` | Allowed frontend origins |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` | `127.0.0.1` / `6379` / `0` | Redis location |
| `REDIS_PASSWORD` | — | Redis password (`requirepass`) |
| `REDIS_TIMEOUT` | `2` | Seconds for connect and socket operations |
| `INFLUXDB_URL` | `http://127.0.0.1:8086` | InfluxDB URL |
| `INFLUXDB_ORG` | `technology-lab` | Organization |
| `INFLUXDB_BUCKET` | `health` | Bucket |
| `INFLUXDB_TOKEN` | — | API token (also the admin token created on first start) |
| `INFLUXDB_TIMEOUT_MS` | `3000` | Per-request timeout in milliseconds |
| `INFLUXDB_ADMIN_USER` / `INFLUXDB_ADMIN_PASSWORD` | `lab_admin` / — | UI login, used only by the container's first-time setup |

## 6. Database setup

```bash
docker compose up -d redis influxdb
docker compose ps        # wait until both show "(healthy)"
```

- **Redis** starts with `--requirepass` and append-only persistence (volume `redis_data`).
  Its health check runs `redis-cli ping` and gets the password from `REDISCLI_AUTH`, so it never appears in the process list.
- **InfluxDB** sets itself up on first start (`DOCKER_INFLUXDB_INIT_MODE=setup`): it creates the org, the
  bucket (7-day retention), the admin user and the API token from `.env`. Data is in `influxdb_data`,
  config in `influxdb_config`. The health check runs `influx ping`. The UI is at http://localhost:8086.

**Verify real read/write operations on both databases:**

```bash
python -m app.database_setup
# INFO Redis verification passed: {'key': 'technology-lab:verification', 'value': '...', 'deleted': True}
# INFO InfluxDB verification passed: {'measurement': 'health_verification', 'run_id': '...', 'time': '...'}
```

- Redis: `SET` a test key (60s expiry as a safety net) → `GET` and compare → `DEL`.
- InfluxDB: write one `health_verification` point tagged with a unique `run_id` → read it back with Flux.

These write data, so they run only on demand, never on health requests.

> Changing `INFLUXDB_TOKEN` or the admin password later has no effect on an existing volume.
> Setup runs only once. Run `docker compose down -v` to start fresh (this deletes all data).

## 7. Running the application

**Local:**

```bash
python -m app.main
```

**Fully containerised:**

```bash
docker compose up -d --build
docker compose logs -f python
docker compose down
```

**Readiness behaviour:**

- The server starts right away and doesn't connect to anything until a health check needs it,
  so `/health` works while the databases are still starting.
- With Docker Compose, the `python` container also waits until both database health checks pass.
- The Redis client reconnects automatically after Redis restarts. InfluxDB is plain HTTP, so every check is a fresh request.
- Both databases are checked in parallel, so with both down the response arrives in about one timeout, not two.
- SIGINT/SIGTERM stops the server cleanly (`docker compose stop python` exits in about 2s).

## 8. API endpoints

| Method | Endpoint | Description | Success | Failure |
|--------|----------|-------------|---------|---------|
| GET | `/health` | Server is running. Touches **neither** database. | 200 | — |
| GET | `/health/app` | Overall status plus a breakdown for each database | 200 | 503 if **either** is down |
| GET | `/health/db` | Redis `PING` + InfluxDB bucket lookup (authenticated) | 200 | 503 if **either** is down |

The InfluxDB check looks up the configured bucket, so it checks the server, the token and the
bucket all at once. A plain `/ping` would only prove the server is up.

**GET /health** → `200`
```json
{"status": "healthy", "service": "python-stdlib-redis-influxdb-api"}
```

**GET /health/app** → `200` / `503`. The top-level `database.status` is the combined status, so
frontends that only read `database.status` keep working.
```json
{
  "status": "unhealthy",
  "service": "python-stdlib-redis-influxdb-api",
  "database": {
    "status": "unhealthy",
    "type": "redis,influxdb",
    "redis": {"status": "unhealthy", "type": "redis"},
    "influxdb": {"status": "healthy", "type": "influxdb"}
  }
}
```

**GET /health/db** → `200` / `503`
```json
{
  "status": "healthy",
  "database": "redis,influxdb",
  "message": "Database connection successful",
  "databases": {
    "redis": {"status": "healthy", "database": "redis", "message": "Database connection successful"},
    "influxdb": {"status": "healthy", "database": "influxdb", "message": "Database connection successful"}
  }
}
```

Other responses: unknown path → `404`; POST/PUT/PATCH/DELETE → `405` with an `Allow` header;
`OPTIONS` → `204`; unexpected error → `500`. Responses never contain credentials, and failures are
logged with the exception type only.

## 9. Testing

```bash
python -m unittest -v       # Redis and InfluxDB must be running
```

The 12 tests start the real HTTP server on a free port and cover:

- all endpoints with both databases up; health checks don't write Redis keys
- **Redis unavailable**, **InfluxDB unavailable**, **both unavailable**: 503, with the correct per-database statuses and responses within the timeouts
- wrong Redis password and wrong InfluxDB token; a missing bucket
- CORS (allowed and blocked origins), preflight, 404, 405
- Redis key/value round trip and InfluxDB write/read round trip

**Manual checks with real containers:**

```bash
curl -i http://localhost:8006/health/db

docker compose stop redis            # → 503, redis unhealthy, influxdb healthy
docker compose stop influxdb         # → 503, both unhealthy
docker compose start redis influxdb  # → 200 again, no API restart needed
```

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| InfluxDB container exits with `unknown command "..." for "setup"` | A secret in `.env` starts with `-`. Use hex secrets, then `docker compose rm -sf influxdb` and remove the `influxdb_data` and `influxdb_config` volumes. |
| InfluxDB is unhealthy with a valid server | Check that `INFLUXDB_TOKEN`, `INFLUXDB_ORG` and `INFLUXDB_BUCKET` match what was set up. Setup runs only on the first start of the volume. |
| `ImportError: cannot import name 'InfluxDBClient'` | You ran `python app/main.py`. Use `python -m app.main`. |
| Redis is unhealthy: `AuthenticationError` | `REDIS_PASSWORD` must match the password the container was started with. Recreate it with `docker compose up -d --force-recreate redis`. |
| Port 8086 or 6379 already in use | Stop the other instance, or change the published port in `docker-compose.yml` and in `.env`. |
| Browser shows a CORS error | Add the origin to `CORS_ALLOWED_ORIGINS` and restart. |
