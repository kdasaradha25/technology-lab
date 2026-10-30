import type { Summary } from '../api/healthApi'
import { stateFromStatus, type BadgeState } from './badgeState'
import { StatusBadge } from './StatusBadge'

interface Props {
  summary: Summary
  loading: { api: boolean; app: boolean; db: boolean }
}

export function SummaryPanel({ summary, loading }: Props) {
  const outcomeState = (outcome: Summary['apiStatus'], isLoading: boolean): BadgeState =>
    isLoading ? 'loading' : (outcome ?? 'not-checked')

  return (
    <section className="panel" aria-labelledby="summary-heading">
      <h2 id="summary-heading">Summary</h2>
      <dl className="summary">
        <div>
          <dt>Service name</dt>
          <dd>{summary.serviceName ?? <span className="muted">Unknown</span>}</dd>
        </div>
        <div>
          <dt>API status</dt>
          <dd><StatusBadge state={outcomeState(summary.apiStatus, loading.api)} /></dd>
        </div>
        <div>
          <dt>Application status</dt>
          <dd><StatusBadge state={outcomeState(summary.appStatus, loading.app)} /></dd>
        </div>
        <div>
          <dt>Database status</dt>
          <dd>
            <StatusBadge state={loading.db || loading.app ? 'loading' : stateFromStatus(summary.databaseStatus)} />
          </dd>
        </div>
        <div>
          <dt>Database type</dt>
          <dd>{summary.databaseType ?? <span className="muted">Unknown</span>}</dd>
        </div>
      </dl>

      {summary.databases.length > 0 && (
        <ul className="database-list" aria-label="Individual databases">
          {summary.databases.map((database) => (
            <li key={database.name}>
              <span>{database.name}</span>
              <StatusBadge state={stateFromStatus(database.status)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
