// Browser-side client for the lab backends' health endpoints. There is no Next.js API route or
// proxy: requests go straight from the browser to the backend, so the backend's CORS policy applies.

export const CHECKS = {
  api: { label: "API Health", path: "/health", action: "Check API Health" },
  app: { label: "Application Health", path: "/health/app", action: "Check Application Health" },
  db: { label: "Database Health", path: "/health/db", action: "Check Database Health" },
} as const;

export type CheckName = keyof typeof CHECKS;
export const CHECK_NAMES = Object.keys(CHECKS) as CheckName[];

export type HealthState =
  | "healthy"
  | "unhealthy"
  | "network-error"
  | "timeout"
  | "invalid-url"
  | "unexpected-response";

export type HealthCheckResult = {
  check: CheckName;
  state: HealthState;
  requestUrl: string | null;
  httpStatus: number | null;
  responseTimeMs: number | null;
  json: unknown;
  detail: string;
  checkedAt: string; // ISO timestamp
};

export type UrlValidation = { ok: true; baseUrl: string } | { ok: false; reason: string };

export function validateBaseUrl(raw: string): UrlValidation {
  const value = raw.trim();
  if (value === "") {
    return { ok: false, reason: "Enter a backend base URL, e.g. http://localhost:8001." };
  }
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    return { ok: false, reason: `The URL needs a scheme. Did you mean http://${value}?` };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: "That is not a valid URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `Unsupported scheme "${parsed.protocol}". Use http:// or https://.` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "Remove the username/password from the URL." };
  }
  if (parsed.search || parsed.hash) {
    return { ok: false, reason: "Use a base URL without ?query or #fragment." };
  }
  return { ok: true, baseUrl: `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}` };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type RunOptions = {
  timeoutMs: number;
  /** Aborts the request early, e.g. when the user switches to another backend. */
  signal?: AbortSignal;
  fetchFn?: typeof fetch;
};

/** Runs one health check. Always resolves; failures are described in the result. */
export async function runHealthCheck(
  rawBaseUrl: string,
  check: CheckName,
  { timeoutMs, signal, fetchFn = fetch }: RunOptions,
): Promise<HealthCheckResult> {
  const now = () => new Date().toISOString();
  const validation = validateBaseUrl(rawBaseUrl);
  if (!validation.ok) {
    return {
      check, state: "invalid-url", requestUrl: null, httpStatus: null,
      responseTimeMs: null, json: null, detail: validation.reason, checkedAt: now(),
    };
  }

  const requestUrl = validation.baseUrl + CHECKS[check].path;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const startedAt = performance.now();
  const took = () => Math.round(performance.now() - startedAt);

  let response: Response;
  let text: string;
  try {
    response = await fetchFn(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: combined,
    });
    text = await response.text();
  } catch {
    const timedOut = timeoutSignal.aborted;
    return {
      check,
      state: timedOut ? "timeout" : "network-error",
      requestUrl,
      httpStatus: null,
      responseTimeMs: took(),
      json: null,
      detail: timedOut
        ? `The backend did not respond within ${timeoutMs} ms.`
        : "Network error: the backend is unreachable, or the browser blocked the response because of CORS.",
      checkedAt: now(),
    };
  }

  const responseTimeMs = took();
  const common = { check, requestUrl, httpStatus: response.status, responseTimeMs, checkedAt: now() };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ...common,
      state: "unexpected-response",
      json: text.slice(0, 1000),
      detail: `HTTP ${response.status} returned non-JSON content. Is this a Technology Lab backend?`,
    };
  }

  const reported = isObject(json) ? json.status : undefined;
  if (response.ok && reported === "healthy") {
    return { ...common, state: "healthy", json, detail: `HTTP ${response.status} — reported healthy.` };
  }
  if (response.status === 503 || reported === "unhealthy") {
    return { ...common, state: "unhealthy", json, detail: `HTTP ${response.status} — reported unhealthy.` };
  }
  return {
    ...common,
    state: "unexpected-response",
    json,
    detail: `HTTP ${response.status} without a recognised health status.`,
  };
}

export type BackendOverview = {
  serviceName: string | null;
  databaseType: string | null;
  databaseStatus: string | null;
  databases: { name: string; status: string }[];
};

/** Pulls the descriptive fields out of whichever responses are available. */
export function describeBackend(results: Partial<Record<CheckName, HealthCheckResult>>): BackendOverview {
  const json = (name: CheckName) => (isObject(results[name]?.json) ? (results[name]!.json as Record<string, unknown>) : {});
  const str = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : null);

  const api = json("api");
  const app = json("app");
  const db = json("db");
  const appDb = isObject(app.database) ? app.database : {};

  // Backends with more than one database add a per-database breakdown.
  const source = isObject(db.databases) ? db.databases : appDb;
  const databases = Object.entries(source)
    .filter((entry): entry is [string, Record<string, unknown>] => isObject(entry[1]) && typeof entry[1].status === "string")
    .map(([name, info]) => ({ name, status: info.status as string }));

  return {
    serviceName: str(app.service) ?? str(api.service),
    databaseType: str(appDb.type) ?? str(db.database),
    databaseStatus: str(db.status) ?? str(appDb.status),
    databases,
  };
}
