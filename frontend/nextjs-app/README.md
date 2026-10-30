# Frontend 02 — Next.js

A single-page **Backend & Database Health Monitor** built with Next.js (App Router), React and
TypeScript. It's an independent project; it doesn't reuse code from the React/Vite app.

- URL: **http://localhost:3000** (every lab backend allows CORS from this origin)
- Health requests go **directly from the browser to the backend**. There are no API routes,
  proxies or server actions in this app.
- Checks run only when you click a button; nothing polls.

## Technology stack

| Component | Version |
|-----------|---------|
| Next.js (App Router, `output: "standalone"`) | 16.4 |
| React | 19.3 |
| TypeScript | 5 |
| Styling | CSS Modules + one global stylesheet (system fonts, light and dark themes) |
| Tests | Vitest + Testing Library (jsdom) |
| Docker | `node:22-alpine`, multi-stage, non-root user |

## Features

| Area | Details |
|------|---------|
| Backend configuration | Six sample buttons (Django + PostgreSQL, FastAPI + MySQL, Express.js + MongoDB, Go + Cassandra, PHP + SQLite, Python + Redis + InfluxDB) and a free-text base URL field. The page shows whether the URL matches a sample or is custom. |
| Health checks | **Check API Health** → `/health`, **Check Application Health** → `/health/app`, **Check Database Health** → `/health/db`, **Check All** (parallel) |
| Overview | Backend service name, API health, application health, database health, database type, last checked time, and a per-database breakdown for the Python + Redis + InfluxDB backend |
| Status cards | One per endpoint: status, HTTP response code, response time, check time, and a collapsible raw JSON response |
| States | Healthy · Unhealthy · Loading · Network error · Timeout · Invalid URL · Unexpected response, each shown with a colour, a symbol and a text label |

Changing the backend cancels requests still in flight and clears the old results.

## Project structure

```
app/
├── layout.tsx              # root layout + metadata (title)
├── page.tsx                # Server Component: page shell, renders <HealthMonitor />
├── page.module.css
└── globals.css             # colour tokens, base element styles
components/
├── HealthMonitor.tsx       # "use client": state (useReducer), runs checks, cancels on backend change
├── BackendPicker.tsx       # sample buttons + base URL input
├── OverviewCard.tsx        # combined status overview
├── CheckCard.tsx           # one status card per endpoint
├── StatusIndicator.tsx     # status pill (colour + symbol + label)
└── monitor.module.css
lib/
├── backends.ts             # sample backends from NEXT_PUBLIC_* variables, request timeout
└── health-client.ts        # URL validation, fetch with AbortSignal timeout, outcome classification
test/                       # Vitest tests
```

## Prerequisites

- Node.js 20.9+ (22 recommended) and npm, **or** Docker Desktop
- At least one lab backend running, to see real results (see `../../backend/*/README.md`)

## Running

### With Docker (recommended)

```bash
cd frontend/nextjs-app
docker compose up -d --build      # http://localhost:3000
docker compose logs -f nextjs
docker compose down
```

How the image is built:

1. `deps`: `npm ci`
2. `build`: `next build` with the `NEXT_PUBLIC_*` values passed as **build args**
3. `runner`: only `.next/standalone` (a minimal `server.js` with its traced dependencies),
   `.next/static` and `public`, running as the unprivileged `nextjs` user on port 3000, with a health check

Things to know:

- **Keep host port 3000.** The backends only allow CORS from `http://localhost:3000`, `:5173` and `:4200`.
- **Backend URLs stay `http://localhost:800x`.** The health requests run in your *browser*, not in the
  container, so the browser reaches each backend through its published port.
- **`NEXT_PUBLIC_*` values are frozen at build time.** Next.js inlines them into the JavaScript. After
  changing them in `.env`, rebuild with `docker compose up -d --build`.

### Without Docker

```bash
npm install
npm run dev        # development server with hot reload, http://localhost:3000
# or a production build:
npm run build && npm start
```

Other scripts: `npm test` (Vitest), `npm run lint` (ESLint).

## Configuration

Optional. Copy `.env.example` to `.env`:

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_DJANGO_URL` | `http://localhost:8001` |
| `NEXT_PUBLIC_FASTAPI_URL` | `http://localhost:8002` |
| `NEXT_PUBLIC_EXPRESS_URL` | `http://localhost:8003` |
| `NEXT_PUBLIC_GO_URL` | `http://localhost:8004` |
| `NEXT_PUBLIC_PHP_URL` | `http://localhost:8005` |
| `NEXT_PUBLIC_PYTHON_URL` | `http://localhost:8006` |
| `NEXT_PUBLIC_REQUEST_TIMEOUT_MS` | `5000` |

These are public, non-secret values; anything prefixed `NEXT_PUBLIC_` ends up in the browser
bundle. The app needs no secrets.

## How results are classified

| State | When |
|-------|------|
| Healthy | HTTP 2xx and the JSON body has `"status": "healthy"` |
| Unhealthy | HTTP 503, or `"status": "unhealthy"` |
| Network error | No response: backend down, wrong host or port, or the browser blocked the response because of **CORS**. Browsers report these the same way, so the message names both. |
| Timeout | No complete response within `NEXT_PUBLIC_REQUEST_TIMEOUT_MS` (`AbortSignal.timeout`) |
| Invalid URL | Empty, missing `http://`/`https://`, another scheme, contains credentials, a query or a fragment. No request is sent. |
| Unexpected response | Non-JSON body, or a status code without a recognised health status (e.g. 404) |

## Testing

**Automated (24 tests):** `npm test`

- `health-client`: the exact URL for each endpoint, healthy/unhealthy, network error, timeout, a caller
  abort reported as a network error (not a timeout), invalid URLs (no request sent), non-JSON and 404 responses,
  and the overview for single- and multi-database backends.
- `HealthMonitor`: six samples and no request on load, each button calls its own endpoint,
  Check All fills the overview and cards, unhealthy/network-error/invalid-URL states, switching backend
  clears old results, per-database breakdown.

**Verified in a real browser (headless Edge) against the Docker container and running backends:**

| Backend | Result |
|---------|--------|
| Django + PostgreSQL (8001) | 3 × Healthy |
| FastAPI + MySQL (8002) | 3 × Healthy |
| Express.js + MongoDB (8003) | 3 × Healthy |
| Go + Cassandra (8004) | 3 × Healthy |
| PHP + SQLite (8005) | 3 × Healthy |
| Python + Redis + InfluxDB (8006) | 3 × Healthy; with Redis stopped: API Healthy, app/db Unhealthy (HTTP 503), redis Unhealthy / influxdb Healthy |
| `http://10.255.255.1:8001` | Timeout after 5s |
| `http://localhost:8099` (nothing listening) | Network error |
| `localhost:8001` | Invalid URL ("Did you mean http://localhost:8001?") |
| 390px-wide viewport | Single column, no horizontal scrolling |

The test also confirmed that **zero** health requests went through the Next.js server, and that
the page loads and runs with no backend running.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Every check shows "Network error" | Check that the backend runs (`curl http://localhost:8001/health`). If curl works, it's CORS: open the app at `http://localhost:3000`, not `http://127.0.0.1:3000` (a different origin) or another port. |
| `port is already allocated` / `EADDRINUSE :3000` | Another app is using port 3000. Stop it, or stop the container (`docker compose down`) before running `npm run dev`. |
| Changed `.env` but the URLs didn't change | `NEXT_PUBLIC_*` values are baked in at build time. Rebuild: `docker compose up -d --build` (or restart `npm run dev`). |
| `npm install` fails with an `@types/node` peer conflict | Keep `@types/node` at `^22`. Vitest 5 requires 22 or newer. |
