# Shared Development Rules — All Applications

These rules apply to every frontend and backend project.

## 1. Keep projects independent
- Each application must have its own directory.
- Each application must have its own dependencies.
- Each application must have its own README.
- Do not create a monorepo unless explicitly requested.

## 2. Avoid unnecessary complexity
- No authentication.
- No user registration.
- No JWT.
- No complex CRUD functionality.
- No unnecessary business logic.
- No microservices architecture.
- No message queues.
- No background jobs.
- No unnecessary design patterns.

## 3. Database verification
Every backend must genuinely connect to its assigned database.

Implement a simple database table, collection, or key/value record where appropriate.

Verify:
- Database connection.
- Data insertion.
- Data retrieval.
- Database unavailable scenario.
- Connection timeout handling.

Health checks must not create test records repeatedly.

## 4. Health-check consistency
Every backend must implement the agreed three endpoints:

- GET /health
- GET /health/app
- GET /health/db

Follow the shared JSON response contract.

The API health endpoint must not depend on database availability.

Database health checks must perform a real lightweight operation.

## 5. Configuration and security
- Use environment variables.
- Provide `.env.example`.
- Never commit actual secrets.
- Never return database credentials.
- Do not hardcode production credentials.
- Use appropriate connection timeouts.
- Handle errors gracefully.

## 6. Testing
Every project must be tested before completion.

Do not claim that a feature works without running it.

Verify:
- Application startup.
- API responses.
- Database connectivity.
- Database operations.
- Error scenarios.
- Dependency failure scenarios.

## 7. Documentation
Every project must have a README with:

1. Project overview.
2. Technology stack.
3. Prerequisites.
4. Installation instructions.
5. Environment configuration.
6. Database setup.
7. Application startup commands.
8. API endpoint documentation.
9. Testing instructions.
10. Common troubleshooting steps.

## 8. Completion report
After implementation, provide:

- Files created.
- Technologies used.
- Commands to run the project.
- Database connection details (without secrets).
- Endpoint testing results.
- Known limitations.
- Any remaining issues.

Do not stop after generating source code. Run the project and verify it.