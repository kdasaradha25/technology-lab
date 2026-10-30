# Backend 03 — Express.js + MongoDB

## 1. Project overview

A minimal REST API that demonstrates Express.js + Mongoose talking to a real MongoDB database.
It exposes the three shared health endpoints used by every backend in the Technology Lab,
so any of the lab frontends can connect to it.

- Service name: `express-mongodb-api`
- API port: **8003**
- MongoDB host port: **27017**

## 2. Technology stack

| Component | Version |
|-----------|---------|
| Node.js | 20+ (container uses 22) |
| Express | 5.3 |
| Mongoose | 8.24 |
| dotenv | 16.6 |
| cors | 2.8 |
| supertest + `node:test` | tests |
| MongoDB | 8.0 (Docker, `mongo:8.0`) |

Dependency versions are pinned exactly in `package.json` and `package-lock.json`.

## Project structure

```
express-mongodb/
├── src/
│   ├── server.js                      # entry point: starts HTTP server, connects to MongoDB
│   ├── app.js                         # Express app, CORS, 404 and centralized error handler
│   ├── config/database.js             # connection settings, connect, ping
│   ├── models/HealthRecord.js         # HealthRecord model (health_records collection)
│   ├── routes/health.routes.js        # route definitions
│   └── controllers/health.controller.js
├── tests/
│   ├── health.test.js                 # needs MongoDB running
│   └── health.unavailable.test.js     # points at a dead port to simulate MongoDB being down
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 3. Prerequisites

- Node.js 20 or newer, and npm
- Docker Desktop (with Docker Compose v2)
- curl (optional, for testing)

## 4. Installation

```bash
cd backend/express-mongodb
npm install
```

## 5. Environment configuration

```bash
cp .env.example .env
```

Edit `.env` and set `MONGO_PASSWORD`. `.env` is git-ignored.
Real environment variables override values in `.env`.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8003` | API port |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost:4200` | Allowed frontend origins |
| `MONGO_HOST` | `127.0.0.1` | MongoDB host |
| `MONGO_PORT` | `27017` | MongoDB port |
| `MONGO_DB` | `technology_lab` | Database name |
| `MONGO_USER` | `lab_user` | MongoDB user |
| `MONGO_PASSWORD` | — | MongoDB password (required) |
| `MONGO_AUTH_SOURCE` | `admin` | Database where the user is defined |
| `MONGO_TIMEOUT_MS` | `3000` | Server-selection and connect timeout in ms |

The connection URI is built from these values, and the user and password are URL-encoded.

## 6. Database setup

```bash
docker compose up -d mongo
docker compose ps            # wait for "(healthy)"
```

On the first start, the container creates `MONGO_USER` as a root user in the `admin`
database (that's why `MONGO_AUTH_SOURCE=admin`). That's fine for a local lab;
use a least-privilege user in anything shared.

The health check runs `db.adminCommand('ping')` through `mongosh`.

**HealthRecord collection** (`health_records`):

| Field | Type |
|-------|------|
| `_id` | ObjectId (automatic) |
| `createdAt` | Date (set by Mongoose) |

MongoDB creates the collection on the first insert. Health checks never insert documents.

Stop and start the database:

```bash
docker compose stop mongo     # stop (data is kept)
docker compose start mongo
docker compose down           # remove containers (volume kept)
docker compose down -v        # also delete the mongo_data volume
```

## 7. Running the application

**Local:**

```bash
npm start          # or: npm run dev   (restarts on file changes)
```

**Fully containerised (API + database):**

```bash
docker compose up -d --build
docker compose logs -f express
docker compose down
```

**Startup and reconnection behaviour:**

- The HTTP server starts first, then connects to MongoDB in the background. The API is up even when MongoDB isn't.
- If the first connection fails, each `/health/app` or `/health/db` request tries again, so the
  API becomes healthy as soon as MongoDB is up.
- Once connected, Mongoose reconnects by itself after MongoDB restarts.
- `bufferCommands` is off, so queries fail right away instead of waiting in a queue while MongoDB is down.

## 8. API endpoints

| Method | Endpoint | Description | Success | Failure |
|--------|----------|-------------|---------|---------|
| GET | `/health` | API process is running. Does **not** touch MongoDB. | 200 | — |
| GET | `/health/app` | Application health, including MongoDB status | 200 | 503 |
| GET | `/health/db` | Runs the MongoDB `ping` command | 200 | 503 |

**GET /health** → `200`
```json
{"status": "healthy", "service": "express-mongodb-api"}
```

**GET /health/app** → `200` / `503`
```json
{"status": "healthy", "service": "express-mongodb-api", "database": {"status": "healthy", "type": "mongodb"}}
```
```json
{"status": "unhealthy", "service": "express-mongodb-api", "database": {"status": "unhealthy", "type": "mongodb"}}
```

**GET /health/db** → `200` / `503`
```json
{"status": "healthy", "database": "mongodb", "message": "Database connection successful"}
```
```json
{"status": "unhealthy", "database": "mongodb", "message": "Database connection failed"}
```

Unknown routes return `404 {"status":"error","message":"Not found"}`. Unexpected errors go to the
central error handler and return `500 {"status":"error","message":"Internal server error"}`.
Responses never contain credentials, and failures are logged with the error name only.

## 9. Testing

**Automated tests.** `health.test.js` needs MongoDB running.

```bash
npm test
```

They cover all three endpoints, health checks not inserting documents, inserting and reading a
HealthRecord (the test deletes it afterwards), CORS, the JSON 404, and the MongoDB-unavailable
case (503s while `/health` stays 200).

**Manual curl checks:**

```bash
curl -i http://localhost:8003/health
curl -i http://localhost:8003/health/app
curl -i http://localhost:8003/health/db
curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" http://localhost:8003/health | grep -i access-control
```

**Failure scenarios:**

| Scenario | How | Expected |
|----------|-----|----------|
| DB stopped | `docker compose stop mongo` | `/health` 200, DB endpoints 503 after about 3s |
| DB restored | `docker compose start mongo` | 200 again with no API restart |
| Invalid credentials | wrong `MONGO_PASSWORD`, restart the API | 503 (authentication fails quickly) |
| Connection timeout | `MONGO_HOST=10.255.255.1` | 503 after `MONGO_TIMEOUT_MS` |
| API started before DB | stop mongo, `npm start`, then start mongo | 503 at first, then 200 once MongoDB is up |

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| `MongoServerError: Authentication failed` | Check `MONGO_USER` and `MONGO_PASSWORD`, and that `MONGO_AUTH_SOURCE=admin`. |
| Password changed in `.env` but MongoDB still rejects it | The root user is created only when the volume is first set up. Run `docker compose down -v` and start again (this deletes the data). |
| `MongooseServerSelectionError` | MongoDB isn't reachable. Check `docker compose ps` and `MONGO_HOST`/`MONGO_PORT`. |
| Port 8003 already in use after Ctrl+C in some shells | On Windows, stopping `npm start` can leave the `node` child running. Find it with `Get-NetTCPConnection -LocalPort 8003` and stop that process, or run `node src/server.js` directly. |
| Port 27017 already in use | Another MongoDB is running. Set `MONGO_PORT=27018` in `.env` and run `docker compose up -d mongo` again. |
| Browser shows a CORS error | Add the origin to `CORS_ALLOWED_ORIGINS` and restart. |
