# Backend Application 04 — Go + Apache Cassandra

## Objective
Build a minimal HTTP REST API using Go's standard `net/http` package and Apache Cassandra.

The purpose is to understand Go backend development and Cassandra integration without adding a Go web framework.

## Technology requirements
- Go
- Standard library `net/http`
- Apache Cassandra
- gocql driver
- Environment variables
- Docker Compose

## API endpoints

Implement:

1. `GET /health`
   - Check whether the HTTP server is running.
   - No database dependency.

2. `GET /health/app`
   - Check application health.
   - Include Cassandra connectivity status.

3. `GET /health/db`
   - Execute an actual lightweight Cassandra query.
   - Verify connectivity.
   - Return HTTP 503 when Cassandra is unavailable.

Follow the common JSON response contract.

## Database requirements
- Connect to Cassandra using gocql.
- Configure contact points, keyspace, and connection settings through environment variables.
- Create a simple keyspace and `health_records` table.
- Use an appropriate partition key.
- Store an ID and timestamp.
- Verify insertion and retrieval.
- Use a lightweight query for health checks.

## Project structure

- `main.go`
- `internal/config/config.go`
- `internal/database/cassandra.go`
- `internal/handlers/health.go`
- `internal/models/health_record.go`

Avoid unnecessary packages and abstraction.

## Docker requirements
- Cassandra Docker service.
- Persistent storage.
- Health check.
- Handle Cassandra initialization delays and readiness correctly.

## Deliverables
- `go.mod`
- `go.sum`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.gitignore`
- `README.md`
- Complete Go source code.

## Testing
- Test all three endpoints.
- Verify Cassandra connectivity.
- Verify data insertion and retrieval.
- Verify database-unavailable handling.

Use idiomatic Go, proper context timeouts, and graceful server shutdown.

Build and run the application successfully.