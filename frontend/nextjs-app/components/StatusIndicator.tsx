import type { HealthState } from "@/lib/health-client";
import styles from "./monitor.module.css";

export type IndicatorState = HealthState | "loading" | "idle";

const TEXT: Record<IndicatorState, { icon: string; label: string; tone: string }> = {
  healthy: { icon: "●", label: "Healthy", tone: "good" },
  unhealthy: { icon: "●", label: "Unhealthy", tone: "bad" },
  "network-error": { icon: "▲", label: "Network error", tone: "bad" },
  timeout: { icon: "◷", label: "Timeout", tone: "warn" },
  "invalid-url": { icon: "!", label: "Invalid URL", tone: "warn" },
  "unexpected-response": { icon: "?", label: "Unexpected response", tone: "warn" },
  loading: { icon: "○", label: "Loading…", tone: "busy" },
  idle: { icon: "○", label: "Not checked", tone: "idle" },
};

/** Coloured indicator that also carries a text label, so it never relies on colour alone. */
export function StatusIndicator({ state }: { state: IndicatorState }) {
  const { icon, label, tone } = TEXT[state];
  return (
    <span className={`${styles.indicator} ${styles[tone]}`} data-state={state}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
