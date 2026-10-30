# Frontend 03 — Angular

A single-page **Backend & Database Health Monitor** built with modern Angular: standalone
components, signals, `HttpClient` and the new control-flow syntax. Not AngularJS. Pick a lab
backend (or type any URL), run the health checks, and see each backend's API, application and
database status.

- URL: **http://localhost:4200** (every lab backend allows CORS from this origin)
- Requests go straight from the browser to the backend through `HttpClient`; there's no proxy.
- No routing, no extra pages, no authentication, no polling.

## Technology stack

| Component | Version |
|-----------|---------|
| Angular (standalone, zoneless, signals) | 22.2 |
| TypeScript | 6.0 |
| HTTP | `HttpClient` with `withFetch()` + RxJS `timeout` |
| Styling | Plain CSS (global tokens + component styles), light and dark themes |
| Tests | `ng test` → Vitest + jsdom, `HttpTestingController` |
| Docker | `node:22-alpine` build → `nginx:1.27-alpine` (about 74 MB) |

`@angular/router` and `@angular/forms` were removed from the generated project because they're
not needed: there's no routing, and the URL field is bound with signals.

## Project structure

```
src/
├── index.html / main.ts / styles.css
└── app/
    ├── app.ts, app.html, app.css     # root standalone component: page layout, state (signals), summary
    ├── app.config.ts                 # provideHttpClient(withFetch())
    ├── health.models.ts              # TypeScript interfaces for /health, /health/app, /health/db + UI types
    ├── health.service.ts             # the only service: HTTP calls, timeout, error handling, URL validation
    ├── backends.ts                   # sample backend presets + request-timeout injection token
    └── components/
        ├── health-card.ts            # status card for one endpoint (HTTP code, time, raw JSON)
        └── status-badge.ts           # status pill (colour + symbol + text)
```

### Typed API responses

`health.models.ts` defines `ApiHealthResponse`, `AppHealthResponse` and `DbHealthResponse`, matching
the shared contract. They include the optional per-database breakdown that the Python + Redis + InfluxDB
backend adds (`database.redis`, `database.influxdb`, `databases`).

### How `HealthService` handles responses and errors

| Situation | How it's detected | UI state |
|-----------|-------------------|----------|
| 2xx and `"status": "healthy"` | `HttpResponse` | Healthy |
| 503, or `"status": "unhealthy"` | `HttpErrorResponse` with a JSON body (non-2xx goes to the error path in Angular) | Unhealthy |
| No response (backend down, wrong port, DNS, **CORS**) | `HttpErrorResponse.status === 0` | Connection failed |
| No answer within 5s | RxJS `timeout()` → `TimeoutError` (the request is cancelled) | Request timeout |
| Empty, missing scheme, non-http(s), credentials, query or fragment | Checked before the request; nothing is sent | Invalid API URL |
| Non-JSON body or other status codes (e.g. 404) | Body or status not recognised | Unexpected response |

`check()` always emits exactly one `CheckResult` and never errors, so components don't need error handling.
Changing the backend cancels requests in flight (`takeUntil`) and clears old results.

## Prerequisites

- Node.js 20.19+ / 22.12+ / 24+ and npm, **or** Docker Desktop
- At least one lab backend running, to see real results (see `../../backend/*/README.md`)

## Running

### With Docker

```bash
cd frontend/angular-app
docker compose up -d --build      # http://localhost:4200
docker compose down
```

A two-stage image: `ng build --configuration production` in Node, then nginx serves
`dist/angular-app/browser`. nginx returns `index.html` for unknown paths, caches hashed assets for a long
time, and has a container health check.

- **Keep host port 4200.** The backends only allow CORS from `http://localhost:4200`, `:3000` and `:5173`.
- **The backend URLs are `http://localhost:800x` even in Docker.** The browser makes the requests, not the container.

### Without Docker

```bash
npm install
npm start            # ng serve → http://localhost:4200 (live reload)
npm run build        # production build into dist/angular-app/browser
```

## Configuration

The sample URLs are in `src/app/backends.ts`, and any URL can be typed into the page. A build can
override them with `--define`, which the Dockerfile does from its `NG_DJANGO_URL` … `NG_PYTHON_URL`
build args (set them in `.env` next to `docker-compose.yml`, then rebuild). The request
timeout (5000 ms) is the `HEALTH_REQUEST_TIMEOUT_MS` injection token in the same file. There are no
secrets and no environment files: everything here is public configuration.

## Testing

**Automated (22 tests):** `npm test` (or `npx ng test --watch=false`)

- `health.service.spec.ts`: URL validation, the exact URL for each of the three endpoints, healthy, 503 unhealthy
  with body, status-0 connection failure, timeout (the request is cancelled), invalid URL (no request sent),
  non-JSON and 404 responses.
- `app.spec.ts`: title and the six presets, no request on load, each button calls its own endpoint, Check All fills
  the summary and cards, mixed healthy/unhealthy/connection-failed results, switching backend clears results,
  the invalid-URL hint, the per-database breakdown.

**Verified in a real browser (headless Edge) against the Docker container and all six running backends:**

| Backend | Result |
|---------|--------|
| Django + PostgreSQL (8001) | 3 × Healthy |
| FastAPI + MySQL (8002) | 3 × Healthy |
| Express.js + MongoDB (8003) | 3 × Healthy |
| Go + Cassandra (8004) | 3 × Healthy (Check All and the three individual buttons) |
| PHP + SQLite (8005) | 3 × Healthy |
| Python + Redis + InfluxDB (8006) | 3 × Healthy, redis/influxdb breakdown; with Redis stopped: API Healthy, app/db Unhealthy (HTTP 503), redis Unhealthy / influxdb Healthy |
| `http://10.255.255.1:8001` | Request timeout after 5s |
| `http://localhost:8099` | Connection failed |
| `localhost:8001` | Invalid API URL ("Did you mean http://localhost:8001?") |
| 390px viewport | Single column, no horizontal scrolling, no console errors |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Every check shows "Connection failed" | Make sure the backend is running (`curl http://localhost:8001/health`). If curl works, it's CORS: open the app at `http://localhost:4200`, not `127.0.0.1:4200` or another port. |
| `Port 4200 is already in use` | The Docker container and `ng serve` both use 4200. Run `docker compose down` first, or stop the other process. |
| Tests fail with "Cannot configure the test module…" after another failure | A failing test left HTTP requests open, and `http.verify()` then failed in teardown. Fix the first failing test; the rest follow. |
