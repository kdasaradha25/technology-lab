import { Component, computed, input } from '@angular/core';
import { CheckState } from '../health.models';

export type BadgeState = CheckState | 'loading' | 'idle';

const DISPLAY: Record<BadgeState, { symbol: string; label: string }> = {
  healthy: { symbol: '✓', label: 'Healthy' },
  unhealthy: { symbol: '✕', label: 'Unhealthy' },
  'connection-failed': { symbol: '⚠', label: 'Connection failed' },
  timeout: { symbol: '⏱', label: 'Request timeout' },
  'invalid-url': { symbol: '!', label: 'Invalid API URL' },
  'unexpected-response': { symbol: '?', label: 'Unexpected response' },
  loading: { symbol: '…', label: 'Loading' },
  idle: { symbol: '–', label: 'Not checked' },
};

/** Status pill. The symbol and text label mean it never relies on colour alone. */
@Component({
  selector: 'app-status-badge',
  template: `<span class="badge" [attr.data-state]="state()"><span aria-hidden="true">{{ display().symbol }}</span> {{ display().label }}</span>`,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 600;
      white-space: nowrap;
      background: var(--idle-bg);
      color: var(--muted);
    }
    [data-state='healthy'] { background: var(--ok-bg); color: var(--ok); }
    [data-state='unhealthy'],
    [data-state='connection-failed'] { background: var(--err-bg); color: var(--err); }
    [data-state='timeout'],
    [data-state='invalid-url'],
    [data-state='unexpected-response'] { background: var(--warn-bg); color: var(--warn); }
    [data-state='loading'] { background: var(--busy-bg); color: var(--busy); }
  `,
})
export class StatusBadge {
  readonly state = input.required<BadgeState>();
  protected readonly display = computed(() => DISPLAY[this.state()]);
}

/** Maps a backend-reported status string to a badge state. */
export function badgeFromReported(status: string | null | undefined): BadgeState {
  if (status === 'healthy' || status === 'unhealthy') return status;
  return status ? 'unexpected-response' : 'idle';
}
