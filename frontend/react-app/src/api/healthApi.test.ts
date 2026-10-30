import { describe, expect, it, vi } from 'vitest'
import { checkEndpoint, normalizeBaseUrl, summarize, type CheckResult } from './healthApi'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const options = (fetchImpl: typeof fetch, timeoutMs = 1000) => ({ fetchImpl, timeoutMs })

describe('normalizeBaseUrl', () => {
  it('accepts http(s) URLs and strips trailing slashes', () => {
    expect(normalizeBaseUrl(' http://localhost:8001/ ')).toBe('http://localhost:8001')
    expect(normalizeBaseUrl('https://api.example.com/lab//')).toBe('https://api.example.com/lab')
  })

  it.each([
    ['', /Enter a backend URL/],
    ['localhost:8001', /http/],
    ['not a url', /not a valid URL/],
    ['ftp://example.com', /Only http/],
    ['http://localhost:8001?x=1', /query string/],
    ['http://user:pass@localhost:8001', /credentials/],
  ])('rejects %j', (input, message) => {
    expect(() => normalizeBaseUrl(input)).toThrow(message)
  })
})

describe('checkEndpoint', () => {
  it.each([
    ['api', 'http://localhost:8001/health'],
    ['app', 'http://localhost:8001/health/app'],
    ['db', 'http://localhost:8001/health/db'],
  ] as const)('calls the %s endpoint at %s', async (endpoint, expectedUrl) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'healthy' }))
    await checkEndpoint('http://localhost:8001/', endpoint, options(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl.mock.calls[0][0]).toBe(expectedUrl)
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'GET' })
  })

  it('classifies a 200 healthy response', async () => {
    const body = { status: 'healthy', service: 'django-postgres-api' }
    const result = await checkEndpoint('http://x', 'api', options(vi.fn().mockResolvedValue(jsonResponse(200, body))))
    expect(result).toMatchObject({ outcome: 'healthy', httpStatus: 200, body })
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('classifies a 503 unhealthy response', async () => {
    const body = { status: 'unhealthy', database: 'postgresql', message: 'Database connection failed' }
    const result = await checkEndpoint('http://x', 'db', options(vi.fn().mockResolvedValue(jsonResponse(503, body))))
    expect(result).toMatchObject({ outcome: 'unhealthy', httpStatus: 503, body })
  })

  it('reports a connection failure when fetch rejects', async () => {
    const result = await checkEndpoint(
      'http://localhost:9',
      'api',
      options(vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))),
    )
    expect(result).toMatchObject({ outcome: 'connection-failed', httpStatus: null })
    expect(result.message).toMatch(/CORS/)
  })

  it('reports a timeout when the backend does not answer in time', async () => {
    const hangingFetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    ) as unknown as typeof fetch
    const result = await checkEndpoint('http://x', 'api', options(hangingFetch, 50))
    expect(result.outcome).toBe('timeout')
    expect(result.message).toMatch(/0.05s/)
  })

  it('reports an invalid URL without making a request', async () => {
    const fetchImpl = vi.fn()
    const result = await checkEndpoint('localhost:8001', 'api', options(fetchImpl))
    expect(result.outcome).toBe('invalid-url')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('flags non-JSON responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>Not found</html>', { status: 404 }))
    const result = await checkEndpoint('http://x', 'api', options(fetchImpl))
    expect(result).toMatchObject({ outcome: 'unexpected-response', httpStatus: 404 })
  })

  it('flags JSON errors that are not health responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(404, { status: 'error', message: 'Not found' }))
    const result = await checkEndpoint('http://x', 'api', options(fetchImpl))
    expect(result.outcome).toBe('unexpected-response')
    expect(result.message).toContain('HTTP 404')
  })
})

describe('summarize', () => {
  const result = (endpoint: CheckResult['endpoint'], outcome: CheckResult['outcome'], body: unknown): CheckResult => ({
    endpoint,
    url: 'http://x',
    outcome,
    httpStatus: 200,
    durationMs: 1,
    body,
    message: '',
    checkedAt: new Date(),
  })

  it('combines a single-database backend', () => {
    const summary = summarize({
      api: result('api', 'healthy', { status: 'healthy', service: 'fastapi-mysql-api' }),
      app: result('app', 'unhealthy', {
        status: 'unhealthy',
        service: 'fastapi-mysql-api',
        database: { status: 'unhealthy', type: 'mysql' },
      }),
    })
    expect(summary).toEqual({
      serviceName: 'fastapi-mysql-api',
      apiStatus: 'healthy',
      appStatus: 'unhealthy',
      databaseStatus: 'unhealthy',
      databaseType: 'mysql',
      databases: [],
    })
  })

  it('lists individual databases for multi-database backends', () => {
    const summary = summarize({
      db: result('db', 'unhealthy', {
        status: 'unhealthy',
        database: 'redis,influxdb',
        databases: {
          redis: { status: 'unhealthy', database: 'redis' },
          influxdb: { status: 'healthy', database: 'influxdb' },
        },
      }),
    })
    expect(summary.databaseType).toBe('redis,influxdb')
    expect(summary.databases).toEqual([
      { name: 'redis', status: 'unhealthy' },
      { name: 'influxdb', status: 'healthy' },
    ])
  })

  it('returns empty values before any check', () => {
    expect(summarize({})).toMatchObject({ serviceName: null, apiStatus: null, databaseStatus: null })
  })
})
