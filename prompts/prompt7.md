# Backend Application 06 — Python Standard Library + Redis + InfluxDB

## Objective
Build a minimal HTTP REST API using Python's built-in libraries without Django, FastAPI, Flask, or any other web framework.

This application will demonstrate native Python HTTP server development and connectivity to two different database technologies.

## Technology requirements
- Python 3.12 or newer
- `http.server` or another suitable standard-library HTTP server
- Redis
- InfluxDB
- Redis Python client (`redis`)
- InfluxDB Python client (`influxdb-client`)
- Docker Compose
- Environment variables

The HTTP server must use Python's standard library. Database drivers are allowed because they are database integration libraries, not web frameworks.

## API endpoints

Implement:

1. `GET /health`
   - Check API server availability.
   - Must not depend on either database.

2. `GET /health/app`
   - Check application health.
   - Include Redis and InfluxDB connectivity statuses.
   - Overall status must be unhealthy if either required database is unavailable.

3. `GET /health/db`
   - Check both Redis and InfluxDB.
   - Return individual database statuses.
   - Return HTTP 503 if either database is unavailable.

Follow the common JSON response contract, extending the database field to represent both databases.

## Redis requirements
- Connect to Redis using the Redis Python client.
- Configure connection details through environment variables.
- Use Redis PING for connectivity verification.
- Create and retrieve a simple test key/value during database functionality verification.
- Do not create unnecessary Redis data on every health request.

## InfluxDB requirements
- Connect using the official InfluxDB Python client.
- Configure URL, organization, bucket, and token through environment variables.
- Perform an actual lightweight query or appropriate connectivity check.
- Write and retrieve a simple time-series data point during database functionality verification.

## Application architecture

Use a simple structure:

- `main.py` — HTTP server and routing.
- `config.py` — environment configuration.
- `health.py` — health-check logic.
- `redis_client.py` — Redis connection.
- `influxdb_client.py` — InfluxDB connection.
- `database_setup.py` — database verification utilities.

Do not introduce unnecessary abstraction.

## Docker requirements
- Redis service.
- InfluxDB service.
- Persistent volumes.
- Health checks.
- Proper startup and readiness handling.

## Deliverables
- `requirements.txt`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.gitignore`
- `README.md`
- Complete source code.

## Testing
- Test all three endpoints.
- Verify Redis connectivity and key/value operations.
- Verify InfluxDB connectivity and time-series write/read operations.
- Test Redis unavailable scenarios.
- Test InfluxDB unavailable scenarios.
- Test both databases unavailable.

## Important
Do not use a Python web framework. The HTTP server must genuinely use Python's standard library.

Build and verify the complete application.