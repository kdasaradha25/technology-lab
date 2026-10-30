export type BackendOption = {
  key: string;
  label: string;
  baseUrl: string;
};

// NEXT_PUBLIC_* values are inlined into the browser bundle at build time. Next.js only replaces
// literal `process.env.NEXT_PUBLIC_X` references, so each one is written out in full.
// They are public, non-secret URLs; none of these backends is assumed to be running.
export const SAMPLE_BACKENDS: BackendOption[] = [
  { key: "django", label: "Django + PostgreSQL", baseUrl: process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8001" },
  { key: "fastapi", label: "FastAPI + MySQL", baseUrl: process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8002" },
  { key: "express", label: "Express.js + MongoDB", baseUrl: process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:8003" },
  { key: "go", label: "Go + Cassandra", baseUrl: process.env.NEXT_PUBLIC_GO_URL || "http://localhost:8004" },
  { key: "php", label: "PHP + SQLite", baseUrl: process.env.NEXT_PUBLIC_PHP_URL || "http://localhost:8005" },
  { key: "python", label: "Python + Redis + InfluxDB", baseUrl: process.env.NEXT_PUBLIC_PYTHON_URL || "http://localhost:8006" },
];

const configuredTimeout = Number(process.env.NEXT_PUBLIC_REQUEST_TIMEOUT_MS);
export const REQUEST_TIMEOUT_MS = configuredTimeout > 0 ? configuredTimeout : 5000;
