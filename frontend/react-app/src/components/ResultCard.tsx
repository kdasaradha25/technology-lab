import { ENDPOINTS, type CheckResult, type EndpointKey } from '../api/healthApi'
import { StatusBadge } from './StatusBadge'

interface Props {
  endpoint: EndpointKey
  result: CheckResult | undefined
  loading: boolean
}

export function ResultCard({ endpoint, result, loading }: Props) {
  const { title, path } = ENDPOINTS[endpoint]
  const state = loading ? 'loading' : (result?.outcome ?? 'not-checked')

  return (
    <article className={`result result--${state}`} aria-busy={loading} aria-labelledby={`result-${endpoint}`}>
      <header className="result__header">
        <h3 id={`result-${endpoint}`}>
          {title} <code>GET {path}</code>
        </h3>
        <StatusBadge state={state} />
      </header>

      {result && !loading && (
        <>
          <p className="result__message">{result.message}</p>
          <dl className="result__meta">
            <div>
              <dt>HTTP status</dt>
              <dd>{result.httpStatus ?? '—'}</dd>
            </div>
            <div>
              <dt>Response time</dt>
              <dd>{result.durationMs === null ? '—' : `${result.durationMs} ms`}</dd>
            </div>
            <div>
              <dt>Checked at</dt>
              <dd>{result.checkedAt.toLocaleTimeString()}</dd>
            </div>
          </dl>
          {result.url && <p className="result__url">{result.url}</p>}
          {result.body !== null && (
            <details open>
              <summary>Response JSON</summary>
              <pre>{typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2)}</pre>
            </details>
          )}
        </>
      )}
    </article>
  )
}
