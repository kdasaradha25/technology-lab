import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { BACKEND_PRESETS } from './backends';
import { HealthCard } from './components/health-card';
import { BadgeState, StatusBadge, badgeFromReported } from './components/status-badge';
import {
  AppHealthResponse,
  CHECKS,
  CheckKind,
  CheckResult,
  DatabaseBreakdownEntry,
  DbHealthResponse,
} from './health.models';
import { HealthService } from './health.service';

type Results = Partial<Record<CheckKind, CheckResult>>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

@Component({
  selector: 'app-root',
  imports: [HealthCard, StatusBadge, DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly health = inject(HealthService);
  private readonly backendChanged = new Subject<void>();

  protected readonly presets = BACKEND_PRESETS;
  protected readonly checks = CHECKS;

  protected readonly baseUrl = signal(BACKEND_PRESETS[0].url);
  protected readonly results = signal<Results>({});
  protected readonly loading = signal<ReadonlySet<CheckKind>>(new Set());
  protected readonly lastChecked = signal<Date | null>(null);

  protected readonly selectedPreset = computed(
    () => this.presets.find((preset) => preset.url === this.baseUrl())?.name ?? '',
  );
  protected readonly busy = computed(() => this.loading().size > 0);

  private readonly bodies = computed(() => {
    const r = this.results();
    const body = (kind: CheckKind) => (isObject(r[kind]?.body) ? (r[kind]!.body as Record<string, unknown>) : {});
    return { api: body('api'), app: body('app') as Partial<AppHealthResponse>, db: body('db') as Partial<DbHealthResponse> };
  });

  protected readonly serviceName = computed(() => {
    const { api, app } = this.bodies();
    return (app.service || (api['service'] as string | undefined)) ?? null;
  });

  protected readonly databaseType = computed(() => {
    const { app, db } = this.bodies();
    return app.database?.type || db.database || null;
  });

  protected readonly databaseState = computed<BadgeState>(() => {
    if (this.loading().has('db') || this.loading().has('app')) return 'loading';
    const { app, db } = this.bodies();
    return badgeFromReported(db.status ?? app.database?.status);
  });

  /** Per-database entries for multi-database backends (e.g. Redis + InfluxDB). */
  protected readonly databases = computed(() => {
    const { app, db } = this.bodies();
    const source: Record<string, unknown> = db.databases ?? app.database ?? {};
    return Object.entries(source)
      .filter((entry): entry is [string, DatabaseBreakdownEntry] => isObject(entry[1]) && typeof entry[1]['status'] === 'string')
      .map(([name, entry]) => ({ name, state: badgeFromReported(entry.status) }));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.backendChanged.next());
  }

  protected stateOf(kind: CheckKind): BadgeState {
    return this.loading().has(kind) ? 'loading' : (this.results()[kind]?.state ?? 'idle');
  }

  protected selectPreset(name: string): void {
    const preset = this.presets.find((p) => p.name === name);
    if (preset) this.setBaseUrl(preset.url);
  }

  protected setBaseUrl(url: string): void {
    this.backendChanged.next(); // cancel requests still running against the previous backend
    this.baseUrl.set(url);
    this.results.set({});
    this.loading.set(new Set());
    this.lastChecked.set(null);
  }

  protected run(kinds: CheckKind[]): void {
    this.loading.update((current) => new Set([...current, ...kinds]));
    for (const kind of kinds) {
      this.health
        .check(this.baseUrl(), kind)
        .pipe(takeUntil(this.backendChanged))
        .subscribe((result) => {
          this.results.update((current) => ({ ...current, [kind]: result }));
          this.loading.update((current) => new Set([...current].filter((k) => k !== kind)));
          this.lastChecked.set(result.checkedAt);
        });
    }
  }

  protected runAll(): void {
    this.run(this.checks.map((check) => check.kind));
  }
}
