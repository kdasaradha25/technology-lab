import { InjectionToken } from '@angular/core';
import { BackendPreset } from './health.models';

/**
 * Sample backend configurations. These are suggestions only (none is assumed to be running);
 * the URL can be edited in the UI. They are public, non-secret values.
 */
export const BACKEND_PRESETS: readonly BackendPreset[] = [
  { name: 'Django + PostgreSQL', url: 'http://localhost:8001' },
  { name: 'FastAPI + MySQL', url: 'http://localhost:8002' },
  { name: 'Express.js + MongoDB', url: 'http://localhost:8003' },
  { name: 'Go + Cassandra', url: 'http://localhost:8004' },
  { name: 'PHP + SQLite', url: 'http://localhost:8005' },
  { name: 'Python + Redis + InfluxDB', url: 'http://localhost:8006' },
];

/** How long to wait for a health response before reporting "Request timeout". */
export const HEALTH_REQUEST_TIMEOUT_MS = new InjectionToken<number>('HEALTH_REQUEST_TIMEOUT_MS', {
  providedIn: 'root',
  factory: () => 5000,
});
