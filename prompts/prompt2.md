# Backend Application 01 — Django + PostgreSQL

## Objective
Build a very simple REST API using Django and PostgreSQL.

This is a minimal technical demonstration project intended to verify Django API development and PostgreSQL database connectivity.

## Technology requirements
- Python
- Django
- Django REST Framework
- PostgreSQL
- psycopg
- Environment variables using `.env`
- Docker Compose for PostgreSQL

## Application requirements

Create a Django project with a simple, maintainable structure.

Implement only these three API endpoints:

1. `GET /health`
   - Check whether the API application is running.
   - Return service name and status.
   - Must not depend on database availability.

2. `GET /health/app`
   - Check application health.
   - Include PostgreSQL connectivity status.
   - Return overall application status.

3. `GET /health/db`
   - Perform an actual lightweight PostgreSQL query.
   - Return database connectivity status.
   - Return HTTP 503 when the database is unavailable.

## Database requirements
- Connect Django to PostgreSQL.
- Use Django's database configuration.
- Store connection details in environment variables.
- Create one simple model named `HealthRecord`.
- Include an ID and created timestamp.
- Create and apply its initial migration.
- Verify that Django can read and write records.

## Project requirements
- Keep the architecture simple.
- Avoid unnecessary apps, models, serializers, services, and repositories.
- Do not introduce Celery, Redis, authentication, or additional features.
- Add proper error handling and logging.
- Never expose database credentials in API responses.

## Docker requirements
- Provide Docker Compose for PostgreSQL.
- Configure a persistent database volume.
- Include a PostgreSQL health check.
- Document how to start and stop the database.

## Deliverables
- Complete working source code.
- `requirements.txt`
- `.env.example`
- `.gitignore`
- `Dockerfile`
- `docker-compose.yml`
- `README.md`

## Testing
- Verify all three endpoints.
- Verify PostgreSQL connectivity.
- Verify the database-unavailable scenario.
- Verify migrations.
- Provide curl commands or equivalent API test commands.

Build the project completely, run the checks, fix errors, and provide the final execution instructions.