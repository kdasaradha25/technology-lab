# Backend 04 — Go + Apache Cassandra

## 1. Project overview

A minimal HTTP API written with Go's standard `net/http` (no web framework) that talks to a
real Apache Cassandra database through the gocql driver. It exposes the three shared health
endpoints used by every backend in the Technology Lab, so any of the lab frontends can connect to it.

- Service name: `go-cassandra-api`
- API port: **8004**
- Cassandra CQL port: **9042**

## 2. Technology stack

| Component | Version |
|-----------|---------|
| Go | 1.24+ (`go.mod`); container builds with `golang:1.24-alpine` |
| HTTP | standard library `net/http` (Go 1.22+ method routing, e.g. `GET /health`) |
| Cassandra driver | gocql — `github.com/apache/cassandra-gocql-driver/v2` v2.1.2 |
| Apache Cassandra | 5.0 (Docker, `cassandra:5.0`) |

The driver is the only third-party dependency. `.env` is read by a small loader in `internal/config`.

## Project structure

```
go-cassandra/
├── main.go                              # wiring, HTTP server, graceful shutdown
├── internal/
│   ├── config/config.go                 # environment variables and the .env loader
│   ├── database/cassandra.go            # session, schema, ping, insert/get/delete
│   ├── database/cassandra_test.go       # integration tests (need Cassandra)
│   ├── handlers/health.go               # /health endpoints, CORS, request logging
│   ├── handlers/health_test.go          # handler unit tests (no Cassandra needed)
│   └── models/health_record.go          # HealthRecord struct
├── go.mod / go.sum
├── Dockerfile                           # multi-stage build, about 23 MB image, runs as a non-root user
└── docker-compose.yml
```

## 3. Prerequisites

- Go 1.24 or newer
- Docker Desktop (with Docker Compose v2). Cassandra needs about 1 GB of RAM.
- curl (optional, for testing)

## 4. Installation

```bash
cd backend/go-cassandra
go mod download
go build -o bin/api .          # Windows: go build -o bin/api.exe .
```

## 5. Environment configuration

```bash
cp .env.example .env
```

Real environment variables override `.env`. The Docker image runs Cassandra **without
authentication**, so the username and password stay empty by default.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8004` | API port |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost:4200` | Allowed frontend origins |
| `CASSANDRA_HOSTS` | `127.0.0.1` | Contact points, comma separated |
| `CASSANDRA_PORT` | `9042` | CQL native port |
| `CASSANDRA_KEYSPACE` | `technology_lab` | Keyspace (validated: letters, digits, `_`) |
| `CASSANDRA_CONSISTENCY` | `LOCAL_ONE` | Query consistency level |
| `CASSANDRA_REPLICATION_FACTOR` | `1` | Used when creating the keyspace |
| `CASSANDRA_TIMEOUT` | `3s` | Per-query timeout |
| `CASSANDRA_CONNECT_TIMEOUT` | `5s` | Connection setup timeout |
| `CASSANDRA_USERNAME` / `CASSANDRA_PASSWORD` | empty | Set only if Cassandra uses `PasswordAuthenticator` |

## 6. Database setup

```bash
docker compose up -d cassandra
docker compose ps            # wait for "(healthy)"; the first start takes 1–2 minutes
```

The container health check runs a real CQL query with `cqlsh`, so "healthy" means the
CQL port answers queries, not just that the JVM is running.

The API creates the schema itself on its first connection; both statements are idempotent:

```sql
CREATE KEYSPACE IF NOT EXISTS technology_lab
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

CREATE TABLE IF NOT EXISTS technology_lab.health_records (
  id         timeuuid PRIMARY KEY,
  created_at timestamp
);
```

**Partition key choice:** `id` is a time-based UUID, so every record is its own partition.
Writes spread evenly across nodes with no hot partition, and a record is read back directly
by its key. Health checks never write rows.

Inspect the data:

```bash
docker exec -it go-cassandra-db cqlsh -e "SELECT * FROM technology_lab.health_records LIMIT 10"
```

Stop and start the database:

```bash
docker compose stop cassandra     # stop (data is kept)
docker compose start cassandra
docker compose down               # remove containers (volume kept)
docker compose down -v            # also delete the cassandra_data volume
```

## 7. Running the application

**Local:**

```bash
go run .                     # or run the built binary: ./bin/api
```

**Fully containerised (API + Cassandra):**

```bash
docker compose up -d --build
docker compose logs -f go
docker compose down
```

**Startup, readiness and shutdown behaviour:**

- The HTTP server starts immediately, and Cassandra is connected in the background, so `/health` works while Cassandra is still starting.
- With Docker Compose, the `go` container also waits for the Cassandra health check to pass.
- If Cassandra isn't reachable, each DB health request retries the connection. Concurrent requests share
  one connection attempt, and each request gives up at its own deadline, because gocql's `CreateSession` can't be cancelled.
- After a failed health query the session is dropped, so the next request reconnects from scratch when Cassandra is back.
- Every database call runs with a `context` timeout.
- On SIGINT/SIGTERM the server stops accepting connections, finishes requests in flight (up to 10s), and closes the session.

## 8. API endpoints

| Method | Endpoint | Description | Success | Failure |
|--------|----------|-------------|---------|---------|
| GET | `/health` | HTTP server is running. Does **not** touch Cassandra. | 200 | — |
| GET | `/health/app` | Application health, including Cassandra status | 200 | 503 |
| GET | `/health/db` | `SELECT release_version FROM system.local` plus a 1-row read from `health_records` | 200 | 503 |

**GET /health** → `200`
```json
{"status": "healthy", "service": "go-cassandra-api"}
```

**GET /health/app** → `200` / `503`
```json
{"status": "healthy", "service": "go-cassandra-api", "database": {"status": "healthy", "type": "cassandra"}}
```
```json
{"status": "unhealthy", "service": "go-cassandra-api", "database": {"status": "unhealthy", "type": "cassandra"}}
```

**GET /health/db** → `200` / `503`
```json
{"status": "healthy", "database": "cassandra", "message": "Database connection successful"}
```
```json
{"status": "unhealthy", "database": "cassandra", "message": "Database connection failed"}
```

Unknown routes return `404 {"status":"error","message":"Not found"}`. Responses never contain connection
details, and failures are logged with the error type only.

## 9. Testing

```bash
go test ./...            # unit + integration (Cassandra must be running)
go test -short ./...     # unit tests only
```

- `handlers` (unit tests with a fake database): all endpoints, healthy and unhealthy, JSON 404, CORS.
- `database` (integration tests against real Cassandra): ping; insert → read → delete a HealthRecord;
  an unavailable port fails fast; concurrent callers respect their context deadline; invalid keyspace names are rejected.

**Manual curl checks:**

```bash
curl -i http://localhost:8004/health
curl -i http://localhost:8004/health/app
curl -i http://localhost:8004/health/db
curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" http://localhost:8004/health | grep -i access-control
```

**Failure scenarios:**

| Scenario | How | Expected |
|----------|-----|----------|
| DB stopped | `docker compose stop cassandra` | `/health` 200, DB endpoints 503 (immediately: the connection is refused) |
| DB restored | `docker compose start cassandra` | 200 again once Cassandra is healthy, with no API restart |
| Connection timeout | `CASSANDRA_HOSTS=10.255.255.1` | 503 after about `CASSANDRA_CONNECT_TIMEOUT` |
| API started before DB | stop Cassandra, start the API, then start Cassandra | 503 at first, then 200 |
| Graceful shutdown | `docker compose stop go` | logs `shutting down` and exits in about 1s |

Invalid credentials don't apply with the default image, because authentication is off.

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| DB endpoints return 503 right after `docker compose up` | Cassandra takes 1–2 minutes on first start. Wait until `docker compose ps` shows `(healthy)`. |
| Container exits or restarts with out-of-memory errors | Give Docker Desktop more memory (at least 2 GB), or lower `MAX_HEAP_SIZE` in `docker-compose.yml`. |
| `gocql: no hosts available in the pool` | Cassandra is down or unreachable. Check `CASSANDRA_HOSTS`/`CASSANDRA_PORT`. |
| `invalid CASSANDRA_KEYSPACE` at startup | Use letters, digits and `_` only, starting with a letter (max 48 characters). |
| `listen tcp :8004: bind: Only one usage...` | Another process holds the port. Run `docker compose stop go`, or stop the old `api` binary. |
| Ctrl+C doesn't stop the server in Git Bash on Windows | Use PowerShell or cmd for Ctrl+C, or `docker compose stop go`. Git Bash can't always deliver a console interrupt to a native Windows program. |
| Browser shows a CORS error | Add the origin to `CORS_ALLOWED_ORIGINS` and restart. |
