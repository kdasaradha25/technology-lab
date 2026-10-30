# Backend 05 — PHP + SQLite

## 1. Project overview

A minimal REST API in plain PHP (no Laravel, Slim or other framework) that uses PDO_SQLITE
to talk to a real SQLite database file. It exposes the three shared health endpoints used by
every backend in the Technology Lab, so any of the lab frontends can connect to it.

- Service name: `php-sqlite-api`
- API port: **8005**
- Database: a single file, by default `database/app.sqlite`

## 2. Technology stack

| Component | Version |
|-----------|---------|
| PHP | 8.3+ (tested with 8.3.36) |
| Web server | PHP built-in development server (`php -S`) |
| Database access | PDO + PDO_SQLITE |
| SQLite | the version bundled with PHP |
| Docker | optional: `php:8.3-cli` image for reproducible runs |

There are no Composer dependencies.

## Project structure

```
php-sqlite/
├── public/index.php          # front controller: CORS, routing, JSON output
├── src/
│   ├── bootstrap.php         # .env loader + class includes (shared by web, CLI and tests)
│   ├── Database.php          # PDO_SQLITE connection, schema, ping, insert/find/delete
│   ├── HealthController.php  # /health, /health/app, /health/db
│   └── Router.php            # exact-match "GET /path" → handler, 404/405
├── bin/init-db.php           # creates the database file and table (idempotent)
├── tests/run-tests.php       # tests with no dependencies
├── database/                 # SQLite file lives here (git-ignored)
├── Dockerfile / docker-compose.yml
└── .env.example
```

## 3. Prerequisites

Either:

- **PHP 8.3+** with the `pdo_sqlite` extension (check with `php -m | grep -i pdo_sqlite`;
  on Windows, enable `extension=pdo_sqlite` in `php.ini`), **or**
- **Docker Desktop**: no local PHP needed.

## 4. Installation

There's nothing to install beyond PHP.

```bash
cd backend/php-sqlite
cp .env.example .env
```

## 5. Environment configuration

`.env` is read by `src/bootstrap.php`; real environment variables override it.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8005` | Host port (used by docker-compose and the README commands) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost:4200` | Allowed frontend origins |
| `DB_PATH` | `database/app.sqlite` | SQLite file. Relative paths are resolved from the project root. |
| `DB_TIMEOUT` | `3` | Seconds to wait if the file is locked by another writer |

SQLite has no server or credentials; access is controlled by file permissions.

## 6. Database setup

Create the database file and table once (it's safe to run again):

```bash
php bin/init-db.php
# Database ready: .../database/app.sqlite (0 health_records)
```

Schema:

```sql
CREATE TABLE IF NOT EXISTS health_records (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))  -- UTC, ISO 8601
);
```

**Design choice:** the API opens the file read-write **without** the create flag
(`PDO::SQLITE_ATTR_OPEN_FLAGS`). If the file is missing, the health check reports
`unhealthy` instead of quietly creating a new, empty database. Only `bin/init-db.php` creates it.

All queries with parameters use prepared statements (`Database::findRecord`, `deleteRecord`).

## 7. Running the application

**With local PHP:**

```bash
php bin/init-db.php
php -S localhost:8005 -t public public/index.php
```

`public/index.php` is passed as the router script, so every request goes through it.

**With Docker (no local PHP needed):**

```bash
docker compose up -d --build     # runs init-db.php, then the built-in server
docker compose logs -f php
docker compose stop              # or: docker compose down  (the volume keeps the data)
docker compose down -v           # also delete the database volume
```

In the container, the app runs as the unprivileged `www-data` user, and the database lives in
the named volume `sqlite_data`, so it survives rebuilds. Compose sets `init: true`: as the
container's main process, `php -S` would ignore the stop signal and be force-killed. With a tiny
init process in front, `docker compose stop` shuts it down cleanly in about 1s. If you use plain
`docker run`, add `--init`.

> The built-in server is meant for development, which suits this lab. For production you'd
> put PHP-FPM behind nginx or Apache.

## 8. API endpoints

| Method | Endpoint | Description | Success | Failure |
|--------|----------|-------------|---------|---------|
| GET | `/health` | PHP API is running. Does **not** open the database. | 200 | — |
| GET | `/health/app` | Application health, including SQLite status | 200 | 503 |
| GET | `/health/db` | Runs `SELECT 1` plus a one-row read of `health_records` | 200 | 503 |

**GET /health** → `200`
```json
{"status": "healthy", "service": "php-sqlite-api"}
```

**GET /health/app** → `200` / `503`
```json
{"status": "healthy", "service": "php-sqlite-api", "database": {"status": "healthy", "type": "sqlite"}}
```
```json
{"status": "unhealthy", "service": "php-sqlite-api", "database": {"status": "unhealthy", "type": "sqlite"}}
```

**GET /health/db** → `200` / `503`
```json
{"status": "healthy", "database": "sqlite", "message": "Database connection successful"}
```
```json
{"status": "unhealthy", "database": "sqlite", "message": "Database connection failed"}
```

Other responses: unknown path → `404`; wrong method → `405` with an `Allow` header;
`OPTIONS` preflight → `204`; unexpected error → `500 {"status":"error","message":"Internal server error"}`.
PHP errors are never shown in responses (`display_errors=0`). Health-check failures are logged
with the exception class and SQLite error code only, never file paths.

## 9. Testing

**Automated tests** (no PHPUnit or Composer needed; each test uses its own temporary database file):

```bash
php tests/run-tests.php

# or with Docker, as a non-root user so the permission test runs too
# (on Git Bash for Windows, prefix with MSYS_NO_PATHCONV=1 and use "$(pwd -W)")
docker run --rm -u www-data -v "$(pwd):/app" -w /app php:8.3-cli php tests/run-tests.php
```

They cover database file and table creation, idempotent init, insert → retrieve → delete with
auto-increment IDs and timestamps, health checks not creating a missing file, all three endpoints,
health checks not writing records, and these failures: missing file, missing table, path is a
directory, file isn't a SQLite database, unreadable file. Plus the router's 404 and 405.

**Manual curl checks:**

```bash
curl -i http://localhost:8005/health
curl -i http://localhost:8005/health/app
curl -i http://localhost:8005/health/db
curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" http://localhost:8005/health | grep -i access-control
```

**Failure scenarios with the running container:**

| Scenario | How | Expected |
|----------|-----|----------|
| File inaccessible | `docker exec php-sqlite-api chmod 000 database/app.sqlite` | DB endpoints 503; `/health` 200 |
| File missing | `docker exec php-sqlite-api mv database/app.sqlite database/app.sqlite.bak` | 503, and the file is **not** recreated |
| Restored | `chmod 644` again, or move the file back | 200 again on the next request |

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| `could not find driver` | Enable `pdo_sqlite`. On Windows, uncomment `extension=pdo_sqlite` in `php.ini`. |
| `/health/db` returns 503 on a fresh checkout | Run `php bin/init-db.php` first. |
| Log shows `PDOException (code 14)` | SQLite can't open the file. Check that `DB_PATH` exists and is readable and writable by the PHP user. |
| `attempt to write a readonly database` | The **directory** must be writable too, because SQLite creates journal files next to the database. |
| `database is locked` | Another process is writing. Increase `DB_TIMEOUT`, or close the other connection. |
| `Failed to listen on localhost:8005` | Port in use: run `docker compose stop`, or choose another port. |
| Docker volume mount paths break in Git Bash | Prefix the command with `MSYS_NO_PATHCONV=1` and use `"$(pwd -W)"`. |
