import { InjectionToken } from '@angular/core';
import { BackendPreset } from './health.models';

// Optional overrides, replaced at build time by `ng build --define` (the Dockerfile passes its
// build args). They are undefined under `ng serve` and in tests, so the localhost defaults apply.
declare const NG_DJANGO_URL: string | undefined;
declare const NG_FASTAPI_URL: string | undefined;
declare const NG_EXPRESS_URL: string | undefined;
declare const NG_GO_URL: string | undefined;
declare const NG_PHP_URL: string | undefined;
declare const NG_PYTHON_URL: string | undefined;

/**
 * Sample backend configurations. These are suggestions only (none is assumed to be running);
 * the URL can be edited in the UI. They are public, non-secret values.
 */
export const BACKEND_PRESETS: readonly BackendPreset[] = [
  { name: 'Django + PostgreSQL', url: (typeof NG_DJANGO_URL !== 'undefined' && NG_DJANGO_URL) || 'http://localhost:8001' },
  { name: 'FastAPI + MySQL', url: (typeof NG_FASTAPI_URL !== 'undefined' && NG_FASTAPI_URL) || 'http://localhost:8002' },
  { name: 'Express.js + MongoDB', url: (typeof NG_EXPRESS_URL !== 'undefined' && NG_EXPRESS_URL) || 'http://localhost:8003' },
  { name: 'Go + Cassandra', url: (typeof NG_GO_URL !== 'undefined' && NG_GO_URL) || 'http://localhost:8004' },
  { name: 'PHP + SQLite', url: (typeof NG_PHP_URL !== 'undefined' && NG_PHP_URL) || 'http://localhost:8005' },
  { name: 'Python + Redis + InfluxDB', url: (typeof NG_PYTHON_URL !== 'undefined' && NG_PYTHON_URL) || 'http://localhost:8006' },
];

/** How long to wait for a health response before reporting "Request timeout". */
export const HEALTH_REQUEST_TIMEOUT_MS = new InjectionToken<number>('HEALTH_REQUEST_TIMEOUT_MS', {
  providedIn: 'root',
  factory: () => 5000,
});
