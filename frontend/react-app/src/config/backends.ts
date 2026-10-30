export interface BackendPreset {
  id: string
  name: string
  url: string
}

const env = import.meta.env

// Sample configurations for the lab backends. They are only suggestions: none of them is
// assumed to be running, and every URL can be overridden in .env or edited in the UI.
export const BACKEND_PRESETS: BackendPreset[] = [
  { id: 'django', name: 'Django + PostgreSQL', url: env.VITE_DJANGO_URL || 'http://localhost:8001' },
  { id: 'fastapi', name: 'FastAPI + MySQL', url: env.VITE_FASTAPI_URL || 'http://localhost:8002' },
  { id: 'express', name: 'Express.js + MongoDB', url: env.VITE_EXPRESS_URL || 'http://localhost:8003' },
  { id: 'go', name: 'Go + Cassandra', url: env.VITE_GO_URL || 'http://localhost:8004' },
  { id: 'php', name: 'PHP + SQLite', url: env.VITE_PHP_URL || 'http://localhost:8005' },
  { id: 'python', name: 'Python + Redis + InfluxDB', url: env.VITE_PYTHON_URL || 'http://localhost:8006' },
]

const parsedTimeout = Number(env.VITE_REQUEST_TIMEOUT_MS)
export const REQUEST_TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 5000
