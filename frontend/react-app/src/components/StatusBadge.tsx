import type { BadgeState } from './badgeState'

const LABELS: Record<BadgeState, string> = {
  healthy: 'Healthy',
  unhealthy: 'Unhealthy',
  'connection-failed': 'Connection failed',
  timeout: 'Request timeout',
  'invalid-url': 'Invalid API URL',
  'unexpected-response': 'Unexpected response',
  loading: 'Checking…',
  'not-checked': 'Not checked',
}

// Symbols make the state readable without relying on colour alone.
const SYMBOLS: Record<BadgeState, string> = {
  healthy: '✓',
  unhealthy: '✕',
  'connection-failed': '⚠',
  timeout: '⏱',
  'invalid-url': '!',
  'unexpected-response': '?',
  loading: '…',
  'not-checked': '–',
}

export function StatusBadge({ state }: { state: BadgeState }) {
  return (
    <span className={`badge badge--${state}`}>
      <span aria-hidden="true">{SYMBOLS[state]}</span> {LABELS[state]}
    </span>
  )
}
