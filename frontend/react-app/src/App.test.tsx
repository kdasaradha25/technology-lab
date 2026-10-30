import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const healthyBodies: Record<string, unknown> = {
  '/health': { status: 'healthy', service: 'django-postgres-api' },
  '/health/app': {
    status: 'healthy',
    service: 'django-postgres-api',
    database: { status: 'healthy', type: 'postgresql' },
  },
  '/health/db': { status: 'healthy', database: 'postgresql', message: 'Database connection successful' },
}

function mockBackend(handler: (path: string) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input))
    return handler(url.pathname)
  })
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const card = (name: RegExp) => screen.getByRole('heading', { level: 3, name }).closest('article') as HTMLElement

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the page title and sample backends without calling any API', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Backend & Database Health Monitor')
    const select = screen.getByLabelText('Sample configuration')
    for (const name of [
      'Django + PostgreSQL',
      'FastAPI + MySQL',
      'Express.js + MongoDB',
      'Go + Cassandra',
      'PHP + SQLite',
      'Python + Redis + InfluxDB',
    ]) {
      expect(within(select).getByRole('option', { name })).toBeInTheDocument()
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls each endpoint from its own button', async () => {
    const fetchSpy = mockBackend((path) => json(200, healthyBodies[path]))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Check API Health' }))
    await user.click(screen.getByRole('button', { name: 'Check Application Health' }))
    await user.click(screen.getByRole('button', { name: 'Check Database Health' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
    expect(fetchSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'http://localhost:8001/health',
      'http://localhost:8001/health/app',
      'http://localhost:8001/health/db',
    ])
  })

  it('runs all checks and shows a healthy summary', async () => {
    mockBackend((path) => json(200, healthyBodies[path]))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Run all checks' }))

    await waitFor(() => expect(screen.getByText(/Last check:/)).toBeInTheDocument())
    expect(screen.getByText('django-postgres-api')).toBeInTheDocument()
    expect(screen.getByText('postgresql')).toBeInTheDocument()
    for (const name of [/API health/, /Application health/, /Database health/]) {
      expect(within(card(name)).getByText('Healthy')).toBeInTheDocument()
      expect(within(card(name)).getByText('200')).toBeInTheDocument()
    }
    expect(within(card(/Database health/)).getByText(/"Database connection successful"/)).toBeInTheDocument()
  })

  it('shows unhealthy database results with HTTP 503', async () => {
    mockBackend((path) =>
      path === '/health'
        ? json(200, healthyBodies['/health'])
        : path === '/health/app'
          ? json(503, { status: 'unhealthy', service: 'django-postgres-api', database: { status: 'unhealthy', type: 'postgresql' } })
          : json(503, { status: 'unhealthy', database: 'postgresql', message: 'Database connection failed' }),
    )
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Run all checks' }))

    await waitFor(() => expect(within(card(/Database health/)).getByText('503')).toBeInTheDocument())
    expect(within(card(/API health/)).getByText('Healthy')).toBeInTheDocument()
    expect(within(card(/Application health/)).getByText('Unhealthy')).toBeInTheDocument()
    expect(within(card(/Database health/)).getByText('Unhealthy')).toBeInTheDocument()
  })

  it('shows connection failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Check API Health' }))

    await waitFor(() => expect(within(card(/API health/)).getByText('Connection failed')).toBeInTheDocument())
    expect(within(card(/API health/)).getByText(/CORS blocked the request/)).toBeInTheDocument()
  })

  it('shows an invalid URL without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText('Backend API URL')
    await user.clear(input)
    await user.type(input, 'localhost:8001')
    await user.click(screen.getByRole('button', { name: 'Check API Health' }))

    await waitFor(() => expect(within(card(/API health/)).getByText('Invalid API URL')).toBeInTheDocument())
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Sample configuration')).toHaveValue('custom')
  })

  it('switches backend, clears old results, and refresh repeats the last checks', async () => {
    const fetchSpy = mockBackend((path) => json(200, healthyBodies[path]))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Check Database Health' }))
    await waitFor(() => expect(within(card(/Database health/)).getByText('Healthy')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Sample configuration'), 'Go + Cassandra')
    expect(screen.getByLabelText('Backend API URL')).toHaveValue('http://localhost:8004')
    expect(within(card(/Database health/)).getByText('Not checked')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(String(fetchSpy.mock.calls[1][0])).toBe('http://localhost:8004/health/db')
  })

  it('shows per-database statuses for multi-database backends', async () => {
    mockBackend(() =>
      json(503, {
        status: 'unhealthy',
        database: 'redis,influxdb',
        message: 'Database connection failed',
        databases: {
          redis: { status: 'unhealthy', database: 'redis', message: 'Database connection failed' },
          influxdb: { status: 'healthy', database: 'influxdb', message: 'Database connection successful' },
        },
      }),
    )
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Check Database Health' }))

    const list = await screen.findByRole('list', { name: 'Individual databases' })
    expect(within(list).getByText('redis').parentElement).toHaveTextContent('Unhealthy')
    expect(within(list).getByText('influxdb').parentElement).toHaveTextContent('Healthy')
  })
})
