# Backend Application 05 — PHP + SQLite

## Objective
Build a minimal REST API using PHP and SQLite without using Laravel or another PHP framework.

The objective is to understand native PHP HTTP handling and database integration.

## Technology requirements
- PHP 8.3 or newer
- PHP built-in development server
- PDO
- PDO_SQLITE
- SQLite
- Environment configuration where appropriate

## API endpoints

Implement:

1. `GET /health`
   - Check whether the PHP API is running.
   - No database dependency.

2. `GET /health/app`
   - Check application health.
   - Include SQLite database status.

3. `GET /health/db`
   - Perform an actual SQLite query.
   - Verify database availability.
   - Return HTTP 503 if the database is unavailable.

Follow the common JSON response contract.

## Database requirements
- Use PDO_SQLITE.
- Create a local SQLite database file.
- Create a simple `health_records` table.
- Include an auto-incrementing ID and created timestamp.
- Verify insertion and retrieval.
- Configure the database file path through an environment variable.

## Project structure

- `public/index.php`
- `src/Database.php`
- `src/HealthController.php`
- `src/Router.php`
- `database/`
- `.env.example`

Keep the implementation minimal and avoid building a custom framework.

## Additional requirements
- Use prepared statements.
- Handle database connection errors.
- Return correct HTTP status codes.
- Do not expose internal errors or credentials.
- Include a `.gitignore` that excludes local database files where appropriate.

## Deliverables
- Complete PHP source code.
- `README.md`
- `.env.example`
- `.gitignore`
- Optional Dockerfile if needed for reproducible execution.

## Testing
- Test all three endpoints.
- Verify SQLite database creation.
- Verify data insertion and retrieval.
- Test missing or inaccessible database file scenarios.

Run the application and verify everything before completion.