/** Response shapes of the shared Technology Lab health contract. */

export type ReportedStatus = 'healthy' | 'unhealthy';

/** GET /health */
export interface ApiHealthResponse {
  status: ReportedStatus;
  service: string;
}

/** Per-database entry used by backends with more than one database (Python + Redis + InfluxDB). */
export interface DatabaseBreakdownEntry {
  status: ReportedStatus;
  type?: string;
  database?: string;
  message?: string;
}

/** GET /health/app */
export interface AppHealthResponse {
  status: ReportedStatus;
  service: string;
  database: {
    status: ReportedStatus;
    type: string;
    // Multi-database backends add one entry per database, e.g. `redis` and `influxdb`.
    [name: string]: DatabaseBreakdownEntry | string;
  };
}

/** GET /health/db */
export interface DbHealthResponse {
  status: ReportedStatus;
  database: string;
  message: string;
  databases?: Record<string, DatabaseBreakdownEntry>;
}

export type HealthResponse = ApiHealthResponse | AppHealthResponse | DbHealthResponse;

export type CheckKind = 'api' | 'app' | 'db';

export interface CheckDefinition {
  kind: CheckKind;
  title: string;
  path: string;
  buttonLabel: string;
}

export const CHECKS: readonly CheckDefinition[] = [
  { kind: 'api', title: 'API Status', path: '/health', buttonLabel: 'Check API Health' },
  { kind: 'app', title: 'Application Status', path: '/health/app', buttonLabel: 'Check Application Health' },
  { kind: 'db', title: 'Database Status', path: '/health/db', buttonLabel: 'Check Database Health' },
];

export type CheckState =
  | 'healthy'
  | 'unhealthy'
  | 'connection-failed'
  | 'timeout'
  | 'invalid-url'
  | 'unexpected-response';

export interface CheckResult {
  kind: CheckKind;
  state: CheckState;
  url: string | null;
  httpStatus: number | null;
  responseTimeMs: number | null;
  /** Parsed JSON body (or raw text when the body was not JSON). */
  body: HealthResponse | string | null;
  message: string;
  checkedAt: Date;
}

export interface BackendPreset {
  name: string;
  url: string;
}
