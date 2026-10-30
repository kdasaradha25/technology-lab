import { CHECKS, type CheckName, type HealthCheckResult } from "@/lib/health-client";
import { StatusIndicator } from "./StatusIndicator";
import styles from "./monitor.module.css";

type Props = {
  check: CheckName;
  result?: HealthCheckResult;
  pending: boolean;
};

export function CheckCard({ check, result, pending }: Props) {
  const { label, path } = CHECKS[check];
  const state = pending ? "loading" : (result?.state ?? "idle");

  return (
    <section className={styles.card} data-check={check} data-state={state} aria-busy={pending} aria-label={label}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.cardTitle}>{label}</h3>
          <code className={styles.path}>GET {path}</code>
        </div>
        <StatusIndicator state={state} />
      </div>

      {!pending && result && (
        <>
          <p className={styles.detail}>{result.detail}</p>
          <dl className={styles.facts}>
            <div>
              <dt>HTTP code</dt>
              <dd data-field="http">{result.httpStatus ?? "—"}</dd>
            </div>
            <div>
              <dt>Response time</dt>
              <dd data-field="time">{result.responseTimeMs === null ? "—" : `${result.responseTimeMs} ms`}</dd>
            </div>
            <div>
              <dt>Checked</dt>
              <dd>{new Date(result.checkedAt).toLocaleTimeString()}</dd>
            </div>
          </dl>
          {result.json !== null && (
            <details className={styles.raw}>
              <summary>Raw JSON response</summary>
              <pre>{typeof result.json === "string" ? result.json : JSON.stringify(result.json, null, 2)}</pre>
            </details>
          )}
        </>
      )}
    </section>
  );
}
