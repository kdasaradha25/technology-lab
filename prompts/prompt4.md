# Backend Application 03 — Express.js + MongoDB

## Objective
Build a minimal REST API using Express.js and MongoDB.

## Technology requirements
- Node.js
- Express.js
- MongoDB
- Mongoose
- dotenv
- Docker Compose

## API endpoints

Implement:

1. `GET /health`
   - Check API availability.
   - Must not depend on MongoDB.

2. `GET /health/app`
   - Check application health.
   - Include MongoDB connection status.

3. `GET /health/db`
   - Perform a real lightweight MongoDB operation.
   - Verify database connectivity.
   - Return HTTP 503 if MongoDB is unavailable.

Follow the common JSON response contract.

## Database requirements
- Connect using Mongoose.
- Use environment variables for MongoDB connection settings.
- Create a simple `HealthRecord` collection.
- Include an ID and created timestamp.
- Verify document insertion and retrieval.
- Use a lightweight ping command for health checks rather than inserting test documents on every health request.

## Project structure

Keep it simple:

- `src/server.js`
- `src/app.js`
- `src/config/database.js`
- `src/models/HealthRecord.js`
- `src/routes/health.routes.js`
- `src/controllers/health.controller.js`

Use async/await and centralized error handling.

## Docker requirements
- MongoDB Docker service.
- Persistent volume.
- Database health check.
- Environment-based connection configuration.

## Deliverables
- `package.json`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.gitignore`
- `README.md`
- Complete source code.

## Testing
- Test all three health endpoints.
- Verify MongoDB connection.
- Verify insertion and retrieval of a HealthRecord.
- Test MongoDB unavailable scenarios.

Do not implement authentication, JWT, CRUD APIs beyond what is necessary for database verification, or additional business features.

Run and verify the complete project.