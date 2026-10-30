# Frontend 01 — React (Vite)

A single-page **Backend & Database Health Monitor** for the Technology Lab. Pick (or type) a backend
URL, run the three health checks, and see the service name, API, application and database status,
database type, HTTP status code, response time and the raw JSON response.

- Dev server: **http://localhost:5173** (every lab backend allows CORS from this origin)
- Stack: React 19, Vite 8, TypeScript, plain CSS, Fetch API
- No backend is assumed to be running; checks run only when you click a button (no polling)

## Features

| Feature | Details |
|---------|---------|
| Backend selection | Dropdown with the six sample backends, plus a free-text URL field. Editing the URL switches the dropdown to "Custom URL". |
| Health checks | **Check API Health** (`/health`), **Check Application Health** (`/health/app`), **Check Database Health** (`/health/db`) |
| Run all checks / Refresh | Run all three in parallel; **Refresh** repeats the last set of checks you ran |
| Summary | Service name, API status, application status, database status, database type, plus a per-database breakdown for multi-database backends (Python + Redis + InfluxDB) |
| Result cards | Status, HTTP status, response time in ms, time of the check, request URL, formatted response JSON |
| States | Healthy, Unhealthy, Checking…, Connection failed, Request timeout, Invalid API URL, Unexpected response, each with a colour **and** a symbol |
| Last check | Time of the last completed check |

Switching to another backend clears the previous results, so you never see one backend's data
labelled with another's URL.

## Project structure

```
src/
├── api/healthApi.ts          # all network logic: URL validation, fetch + timeout, outcome classification, summary
├── config/backends.ts        # sample backends (overridable through VITE_* variables) and request timeout
├── hooks/useHealthChecks.ts  # results/loading state; runs checks on demand, ignores results from a previous backend
├── components/
│   ├── BackendSelector.tsx   # preset dropdown + URL input
│   ├── CheckControls.tsx     # the three check buttons, Run all, Refresh, last-check time
│   ├── SummaryPanel.tsx      # combined status overview
│   ├── ResultCard.tsx        # one card per endpoint
│   ├── StatusBadge.tsx       # coloured status pill with symbol
│   └── badgeState.ts
├── App.tsx                   # page layout
├── index.css                 # styles (light and dark themes, responsive)
├── api/healthApi.test.ts     # unit tests for the API layer
└── App.test.tsx              # component tests (mocked fetch)
```

Components never call `fetch`; they only render the `CheckResult` objects produced by `src/api/healthApi.ts`.

## Prerequisites

- Node.js 20.19+ or 22.12+ (Vite 8 requirement) and npm
- At least one lab backend running, to see real results (see `../../backend/*/README.md`)

## Installation and running

```bash
cd frontend/react-app
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm test             # unit + component tests (Vitest, jsdom)
npm run lint         # oxlint
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build on http://localhost:5173
```

The dev server is pinned to port **5173** (`strictPort`). If the port is taken it stops instead of
switching ports, because the backends only allow CORS from 5173, 3000 and 4200.

### Running in Docker

```bash
docker compose up -d --build     # http://localhost:5173
docker compose down
```

The image is built in two stages. Node runs `npm run build`, then **nginx** serves the static
files from `dist/` (final image about 74 MB, no Node.js). nginx also redirects unknown paths to
`index.html` and caches the hashed `/assets/` files.

Things to know:

- **Keep host port 5173** (`"5173:80"`). The backends only allow CORS from `http://localhost:5173`.
- **Backend URLs stay `http://localhost:800x`.** The health checks run in your *browser*, not
  inside the container, so the browser reaches the backends through their published ports, as with `npm run dev`.
- **`VITE_*` values are fixed at build time.** They're passed as build args (from `.env` if
  present). After changing them, rebuild with `docker compose up -d --build`.
- The container and `npm run dev` both use port 5173, so run only one at a time.
- Use `npm run dev` while editing code (instant reload); use Docker for a production-like, reproducible run.

## Configuration

Everything works without configuration. To change the sample URLs or the timeout, copy `.env.example` to `.env`:

| Variable | Default |
|----------|---------|
| `VITE_DJANGO_URL` | `http://localhost:8001` |
| `VITE_FASTAPI_URL` | `http://localhost:8002` |
| `VITE_EXPRESS_URL` | `http://localhost:8003` |
| `VITE_GO_URL` | `http://localhost:8004` |
| `VITE_PHP_URL` | `http://localhost:8005` |
| `VITE_PYTHON_URL` | `http://localhost:8006` |
| `VITE_REQUEST_TIMEOUT_MS` | `5000` |

`VITE_*` values are compiled into the JavaScript sent to the browser. Never put secrets in them.
The app has no secrets: the backends need no authentication.

## How results are classified

| Outcome | When |
|---------|------|
| Healthy | HTTP 2xx and the JSON body has `"status": "healthy"` |
| Unhealthy | `"status": "unhealthy"`, or HTTP 503 |
| Connection failed | The request never got a response: backend not running, wrong host or port, or **CORS rejected**. Browsers don't let pages tell these apart, so the message names all three. |
| Request timeout | No complete response within `VITE_REQUEST_TIMEOUT_MS` (the request is aborted) |
| Invalid API URL | Not a valid `http(s)://` URL, missing scheme, contains a query or fragment, or contains credentials. No request is sent. |
| Unexpected response | Non-JSON body, or any other status code (e.g. 404 from a server that isn't a lab backend) |

## Testing

**Automated (28 tests):** `npm test`

- API layer: correct URLs for all three endpoints, healthy/unhealthy classification, connection failure,
  timeout (using an aborting fake fetch), invalid URLs (no request sent), non-JSON and 404 responses, and the summary
  for single- and multi-database backends.
- Components: title and the six presets, each button calls its own endpoint, Run all, unhealthy 503
  display, connection failure, invalid URL, switching backend clears results, Refresh repeats the last
  checks against the new URL, per-database breakdown.

**Verified manually in a real browser (headless Edge) against running backends:**

| Scenario | Result |
|----------|--------|
| Python + Redis + InfluxDB, all up | 3 × Healthy (HTTP 200), redis/influxdb breakdown shown |
| PHP + SQLite | 3 × Healthy |
| Python backend with Redis stopped | API Healthy; app and db Unhealthy (HTTP 503); redis Unhealthy, influxdb Healthy |
| Django preset with no backend running | Connection failed |
| `http://10.255.255.1:8001` (unroutable) | Request timeout after 5s |
| `localhost:8001` | Invalid API URL, no request sent |
| Single button + Refresh | Only that endpoint is re-checked |
| 390px-wide mobile viewport | Single column, no horizontal scrolling |

To try it yourself: start a backend (e.g. `cd ../../backend/php-sqlite && docker compose up -d --build`),
run `npm run dev`, choose **PHP + SQLite** and click **Run all checks**. Then stop the backend and
click **Refresh** to see the connection-failed state.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Every check says "Connection failed" | Make sure the backend is running (`curl http://localhost:8001/health`). If curl works but the browser doesn't, it's CORS: the page must be served from `http://localhost:5173`. `http://127.0.0.1:5173` is a **different origin** and isn't on the backends' allow list. |
| `Port 5173 is already in use` | Another dev server is running. On Windows, stopping `npx vite` or `npm run dev` from some shells can leave a `node` process running; find it with `Get-NetTCPConnection -LocalPort 5173` and stop it. |
| "Unexpected response … not JSON" | The URL points at something that isn't a lab backend, or the path prefix is wrong. |
| Changes to `.env` aren't picked up | Restart `npm run dev`; Vite reads `.env` at startup. |
