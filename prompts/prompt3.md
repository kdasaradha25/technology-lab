# Backend Application 02 — FastAPI + MySQL

## Objective
Build a minimal REST API using FastAPI and MySQL to demonstrate API development and database connectivity.

## Technology requirements
- Python
- FastAPI
- Uvicorn
- SQLAlchemy
- PyMySQL or another appropriate MySQL driver
- MySQL
- Environment variables
- Docker Compose

## API endpoints

Implement exactly these endpoints:

1. `GET /health`
   - Check API process availability.
   - No database dependency.

2. `GET /health/app`
   - Check application health.
   - Include MySQL connection status.

3. `GET /health/db`
   - Execute a lightweight MySQL query.
   - Return actual database connectivity status.
   - Return HTTP 503 if the database is unavailable.

Follow the common JSON response contract.

## Database requirements
- Connect FastAPI to MySQL using SQLAlchemy.
- Use a proper database session lifecycle.
- Read connection details from `.env`.
- Create a simple `HealthRecord` table.
- Include an ID and created timestamp.
- Verify database read and write operations.

## Architecture
Use a simple layered structure:

- `main.py` — application entry point.
- `database.py` — database engine and session management.
- `models.py` — SQLAlchemy model.
- `routers/health.py` — health endpoints.
- `config.py` — environment configuration.

Do not create unnecessary abstraction layers.

## Docker requirements
- MySQL Docker service.
- Persistent volume.
- Database health check.
- Application must handle database startup delays.

## Deliverables
- Source code.
- `requirements.txt`
- `.env.example`
- `.gitignore`
- `Dockerfile`
- `docker-compose.yml`
- `README.md`

## Testing
- Test all health endpoints.
- Verify MySQL connectivity.
- Test database failure handling.
- Verify CRUD-level database connectivity using the HealthRecord model.

Build, execute, test, and fix the project before declaring it complete.