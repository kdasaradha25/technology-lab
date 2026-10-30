import type { ReactNode } from "react";
import type { BackendOverview, CheckName, HealthCheckResult } from "@/lib/health-client";
import { StatusIndicator, type IndicatorState } from "./StatusIndicator";
import styles from "./monitor.module.css";

type Props = {
  overview: BackendOverview;
  results: Partial<Record<CheckName, HealthCheckResult>>;
  pending: Record<CheckName, boolean>;
  lastCheckedAt: string | null;
};

function fromReported(status: string | null): IndicatorState {
  if (status === "healthy" || status === "unhealthy") return status;
  return status ? "unexpected-response" : "idle";
}

export function OverviewCard({ overview, results, pending, lastCheckedAt }: Props) {
  const stateOf = (name: CheckName): IndicatorState => (pending[name] ? "loading" : (results[name]?.state ?? "idle"));
  const databaseState: IndicatorState =
    pending.db || pending.app ? "loading" : fromReported(overview.databaseStatus);

  const rows: [string, ReactNode][] = [
    ["Backend service", overview.serviceName ?? "—"],
    ["API health", <StatusIndicator key="api" state={stateOf("api")} />],
    ["Application health", <StatusIndicator key="app" state={stateOf("app")} />],
    ["Database health", <StatusIndicator key="db" state={databaseState} />],
    ["Database type", overview.databaseType ?? "—"],
    ["Last checked", lastCheckedAt ? new Date(lastCheckedAt).toLocaleString() : "Never"],
  ];

  return (
    <section className={styles.card} aria-labelledby="overview-title">
      <h2 id="overview-title" className={styles.cardTitle}>Overview</h2>
      <dl className={styles.overview}>
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {overview.databases.length > 0 && (
        <ul className={styles.databases} aria-label="Database breakdown">
          {overview.databases.map((database) => (
            <li key={database.name}>
              <span className={styles.dbName}>{database.name}</span>
              <StatusIndicator state={fromReported(database.status)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
