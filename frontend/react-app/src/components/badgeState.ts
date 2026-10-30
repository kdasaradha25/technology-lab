import type { Outcome } from '../api/healthApi'

export type BadgeState = Outcome | 'loading' | 'not-checked'

/** Maps a backend-reported status string ("healthy"/"unhealthy") to a badge state. */
export function stateFromStatus(status: string | null): BadgeState {
  if (status === 'healthy' || status === 'unhealthy') return status
  return status ? 'unexpected-response' : 'not-checked'
}
