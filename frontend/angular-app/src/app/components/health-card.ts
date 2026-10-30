import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { CheckDefinition, CheckResult } from '../health.models';
import { BadgeState, StatusBadge } from './status-badge';

/** Status card for one endpoint. */
@Component({
  selector: 'app-health-card',
  imports: [StatusBadge, DatePipe, JsonPipe],
  template: `
    <article class="card" [attr.data-state]="state()" [attr.aria-busy]="loading()" [attr.aria-label]="check().title">
      <header>
        <div>
          <h3>{{ check().title }}</h3>
          <code>GET {{ check().path }}</code>
        </div>
        <app-status-badge [state]="state()" />
      </header>

      @if (result(); as r) {
        @if (!loading()) {
          <p class="message">{{ r.message }}</p>
          <dl>
            <div><dt>HTTP status</dt><dd data-field="http">{{ r.httpStatus ?? '—' }}</dd></div>
            <div><dt>Response time</dt><dd data-field="time">{{ r.responseTimeMs === null ? '—' : r.responseTimeMs + ' ms' }}</dd></div>
            <div><dt>Last checked</dt><dd>{{ r.checkedAt | date: 'mediumTime' }}</dd></div>
          </dl>
          @if (r.url) {
            <p class="url">{{ r.url }}</p>
          }
          @if (r.body !== null) {
            <details>
              <summary>Raw JSON response</summary>
              <pre>{{ isText(r.body) ? r.body : (r.body | json) }}</pre>
            </details>
          }
        }
      }
    </article>
  `,
  styles: `
    .card {
      min-width: 0;
      padding: 16px 18px;
      border: 1px solid var(--line);
      border-top: 4px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
    }
    .card[data-state='healthy'] { border-top-color: var(--ok); }
    .card[data-state='unhealthy'],
    .card[data-state='connection-failed'] { border-top-color: var(--err); }
    .card[data-state='timeout'],
    .card[data-state='invalid-url'],
    .card[data-state='unexpected-response'] { border-top-color: var(--warn); }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
    h3 { margin: 0; font-size: 0.98rem; }
    code { color: var(--muted); font-size: 0.78rem; }
    .message { margin: 12px 0; font-size: 0.9rem; }
    dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
    dt { color: var(--muted); font-size: 0.78rem; }
    dd { margin: 2px 0 0; font-weight: 600; }
    .url { margin: 10px 0 0; color: var(--muted); font-size: 0.8rem; overflow-wrap: anywhere; }
    details { margin-top: 10px; }
    summary { cursor: pointer; font-size: 0.85rem; font-weight: 600; }
    pre {
      max-height: 300px;
      margin: 8px 0 0;
      padding: 10px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--bg);
      font-size: 0.78rem;
    }
  `,
})
export class HealthCard {
  readonly check = input.required<CheckDefinition>();
  readonly result = input<CheckResult | undefined>();
  readonly loading = input(false);

  protected readonly state = computed<BadgeState>(() =>
    this.loading() ? 'loading' : (this.result()?.state ?? 'idle'),
  );

  protected isText(body: unknown): body is string {
    return typeof body === 'string';
  }
}
