// All network logic lives here; components only receive CheckResult objects.

export type EndpointKey = 'api' | 'app' | 'db'

export const ENDPOINTS: Record<EndpointKey, { path: string; title: string; button: string }> = {
  api: { path: '/health', title: 'API health', button: 'Check API Health' },
  app: { path: '/health/app', title: 'Application health', button: 'Check Application Health' },
  db: { path: '/health/db', title: 'Database health', button: 'Check Database Health' },
}

export const ENDPOINT_KEYS = Object.keys(ENDPOINTS) as EndpointKey[]

export type Outcome =
  | 'healthy'
  | 'unhealthy'
  | 'connection-failed'
  | 'timeout'
  | 'invalid-url'
  | 'unexpected-response'

export interface CheckResult {
  endpoint: EndpointKey
  url: string | null
  outcome: Outcome
  httpStatus: number | null
  durationMs: number | null
  body: unknown
  message: string
  checkedAt: Date
}

export class InvalidUrlError extends Error {}

/** Validates a user-entered base URL and returns it without a trailing slash. */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) throw new InvalidUrlError('Enter a backend URL, for example http://localhost:8001')

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new InvalidUrlError('This is not a valid URL. Include the scheme, for example http://localhost:8001')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    // "localhost:8001" parses as scheme "localhost:", so a missing scheme gets its own hint.
    throw new InvalidUrlError(
      trimmed.includes('://')
        ? 'Only http:// and https:// URLs are supported'
        : `Add the scheme, for example http://${trimmed}`,
    )
  }
  if (url.search || url.hash) {
    throw new InvalidUrlError('Remove the query string or #fragment from the URL')
  }
  if (url.username || url.password) {
    throw new InvalidUrlError('Do not put credentials in the URL')
  }
  return url.toString().replace(/\/+$/, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface CheckOptions {
  timeoutMs: number
  fetchImpl?: typeof fetch
}

/** Calls one health endpoint and classifies the outcome. Never throws. */
export async function checkEndpoint(
  baseUrl: string,
  endpoint: EndpointKey,
  { timeoutMs, fetchImpl = fetch }: CheckOptions,
): Promise<CheckResult> {
  const base = { endpoint, httpStatus: null, durationMs: null, body: null }

  let url: string
  try {
    url = normalizeBaseUrl(baseUrl) + ENDPOINTS[endpoint].path
  } catch (err) {
    return { ...base, url: null, outcome: 'invalid-url', message: (err as Error).message, checkedAt: new Date() }
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    const text = await response.text() // still covered by the timeout
    const durationMs = elapsed()
    const result = { ...base, url, httpStatus: response.status, durationMs, checkedAt: new Date() }

    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return {
        ...result,
        body: text.slice(0, 2000),
        outcome: 'unexpected-response',
        message: `HTTP ${response.status}: the response is not JSON. Is this a lab backend?`,
      }
    }

    const status = isRecord(body) ? body.status : undefined
    if (response.ok && status === 'healthy') {
      return { ...result, body, outcome: 'healthy', message: 'The endpoint reported a healthy status.' }
    }
    if (status === 'unhealthy' || response.status === 503) {
      return {
        ...result,
        body,
        outcome: 'unhealthy',
        message: `The endpoint reported an unhealthy status (HTTP ${response.status}).`,
      }
    }
    return {
      ...result,
      body,
      outcome: 'unexpected-response',
      message: `Unexpected response: HTTP ${response.status}${status ? `, status "${String(status)}"` : ''}`,
    }
  } catch {
    const result = { ...base, url, durationMs: elapsed(), checkedAt: new Date() }
    if (timedOut) {
      return { ...result, outcome: 'timeout', message: `No response within ${timeoutMs / 1000}s` }
    }
    // Browsers report refused connections, DNS failures and CORS rejections the same way,
    // so the message names all the likely causes.
    return {
      ...result,
      outcome: 'connection-failed',
      message: 'Could not connect. The backend may not be running, the URL may be wrong, or CORS blocked the request.',
    }
  } finally {
    clearTimeout(timer)
  }
}

export interface DatabaseStatus {
  name: string
  status: string
}

export interface Summary {
  serviceName: string | null
  apiStatus: Outcome | null
  appStatus: Outcome | null
  databaseStatus: string | null
  databaseType: string | null
  databases: DatabaseStatus[]
}

/** Combines the latest results of all three endpoints into the values shown in the summary. */
export function summarize(results: Partial<Record<EndpointKey, CheckResult>>): Summary {
  const body = (key: EndpointKey) => {
    const value = results[key]?.body
    return isRecord(value) ? value : {}
  }
  const api = body('api')
  const app = body('app')
  const db = body('db')
  const appDatabase = isRecord(app.database) ? app.database : {}

  const text = (value: unknown) => (typeof value === 'string' && value ? value : null)

  // Backends with several databases (e.g. Redis + InfluxDB) report a per-database breakdown.
  const databases: DatabaseStatus[] = []
  const breakdown = isRecord(db.databases) ? db.databases : appDatabase
  for (const [name, value] of Object.entries(breakdown)) {
    if (isRecord(value) && typeof value.status === 'string') {
      databases.push({ name, status: value.status })
    }
  }

  return {
    serviceName: text(app.service) ?? text(api.service),
    apiStatus: results.api?.outcome ?? null,
    appStatus: results.app?.outcome ?? null,
    databaseStatus: text(db.status) ?? text(appDatabase.status),
    databaseType: text(appDatabase.type) ?? text(db.database),
    databases,
  }
}
