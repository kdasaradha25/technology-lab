import { ENDPOINT_KEYS, ENDPOINTS, type EndpointKey } from '../api/healthApi'

interface Props {
  loading: Set<EndpointKey>
  lastCheckedAt: Date | null
  onRun: (keys: EndpointKey[]) => void
  onRefresh: () => void
}

export function CheckControls({ loading, lastCheckedAt, onRun, onRefresh }: Props) {
  const busy = loading.size > 0

  return (
    <section className="panel" aria-labelledby="checks-heading">
      <h2 id="checks-heading">Health checks</h2>
      <div className="button-row">
        {ENDPOINT_KEYS.map((key) => (
          <button key={key} type="button" onClick={() => onRun([key])} disabled={loading.has(key)}>
            {ENDPOINTS[key].button}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button type="button" className="primary" onClick={() => onRun(ENDPOINT_KEYS)} disabled={busy}>
          Run all checks
        </button>
        <button type="button" onClick={onRefresh} disabled={busy}>
          Refresh
        </button>
        <p className="last-check" aria-live="polite">
          {busy
            ? 'Checking…'
            : lastCheckedAt
              ? `Last check: ${lastCheckedAt.toLocaleTimeString()}`
              : 'No checks run yet'}
        </p>
      </div>
    </section>
  )
}
