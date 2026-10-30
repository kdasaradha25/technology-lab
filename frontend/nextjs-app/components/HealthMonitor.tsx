"use client";

import { useReducer, useRef } from "react";
import { REQUEST_TIMEOUT_MS, SAMPLE_BACKENDS } from "@/lib/backends";
import {
  CHECK_NAMES,
  CHECKS,
  describeBackend,
  runHealthCheck,
  type CheckName,
  type HealthCheckResult,
} from "@/lib/health-client";
import { BackendPicker } from "./BackendPicker";
import { CheckCard } from "./CheckCard";
import { OverviewCard } from "./OverviewCard";
import styles from "./monitor.module.css";

type State = {
  baseUrl: string;
  results: Partial<Record<CheckName, HealthCheckResult>>;
  pending: Record<CheckName, boolean>;
  lastCheckedAt: string | null;
};

type Action =
  | { type: "set-url"; baseUrl: string }
  | { type: "started"; checks: CheckName[] }
  | { type: "finished"; result: HealthCheckResult };

const idle: Record<CheckName, boolean> = { api: false, app: false, db: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set-url":
      // Results describe the previous backend, so they are discarded.
      return { baseUrl: action.baseUrl, results: {}, pending: idle, lastCheckedAt: null };
    case "started":
      return { ...state, pending: { ...state.pending, ...Object.fromEntries(action.checks.map((c) => [c, true])) } };
    case "finished":
      return {
        ...state,
        results: { ...state.results, [action.result.check]: action.result },
        pending: { ...state.pending, [action.result.check]: false },
        lastCheckedAt: action.result.checkedAt,
      };
  }
}

export function HealthMonitor() {
  const [state, dispatch] = useReducer(reducer, {
    baseUrl: SAMPLE_BACKENDS[0].baseUrl,
    results: {},
    pending: idle,
    lastCheckedAt: null,
  });
  // One controller per backend URL: changing the URL cancels requests still in flight.
  const controller = useRef(new AbortController());

  const changeBackend = (baseUrl: string) => {
    controller.current.abort();
    controller.current = new AbortController();
    dispatch({ type: "set-url", baseUrl });
  };

  const check = (names: CheckName[]) => {
    const signal = controller.current.signal;
    dispatch({ type: "started", checks: names });
    for (const name of names) {
      void runHealthCheck(state.baseUrl, name, { timeoutMs: REQUEST_TIMEOUT_MS, signal }).then((result) => {
        if (!signal.aborted) dispatch({ type: "finished", result });
      });
    }
  };

  const busy = CHECK_NAMES.some((name) => state.pending[name]);

  return (
    <div className={styles.monitor}>
      <BackendPicker options={SAMPLE_BACKENDS} baseUrl={state.baseUrl} onChange={changeBackend} />

      <div className={styles.actions} role="group" aria-label="Health checks">
        {CHECK_NAMES.map((name) => (
          <button key={name} type="button" onClick={() => check([name])} disabled={state.pending[name]}>
            {CHECKS[name].action}
          </button>
        ))}
        <button type="button" className={styles.primary} onClick={() => check(CHECK_NAMES)} disabled={busy}>
          Check All
        </button>
      </div>

      <OverviewCard
        overview={describeBackend(state.results)}
        results={state.results}
        pending={state.pending}
        lastCheckedAt={state.lastCheckedAt}
      />

      <div className={styles.grid}>
        {CHECK_NAMES.map((name) => (
          <CheckCard key={name} check={name} result={state.results[name]} pending={state.pending[name]} />
        ))}
      </div>
    </div>
  );
}
