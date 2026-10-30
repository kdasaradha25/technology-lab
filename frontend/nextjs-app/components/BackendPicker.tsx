import type { BackendOption } from "@/lib/backends";
import styles from "./monitor.module.css";

type Props = {
  options: BackendOption[];
  baseUrl: string;
  onChange: (baseUrl: string) => void;
};

export function BackendPicker({ options, baseUrl, onChange }: Props) {
  const matching = options.find((option) => option.baseUrl === baseUrl);

  return (
    <fieldset className={styles.card}>
      <legend className={styles.cardTitle}>Backend configuration</legend>

      <div className={styles.samples} role="group" aria-label="Sample configurations">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={styles.sample}
            aria-pressed={matching?.key === option.key}
            onClick={() => onChange(option.baseUrl)}
          >
            <span>{option.label}</span>
            <small>{option.baseUrl}</small>
          </button>
        ))}
      </div>

      <label className={styles.urlLabel} htmlFor="backend-url">
        Backend API base URL
      </label>
      <input
        id="backend-url"
        className={styles.urlInput}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="http://localhost:8001"
        value={baseUrl}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className={styles.help}>
        {matching ? `Sample: ${matching.label}. ` : "Custom URL. "}
        Samples are only suggestions; the backend must be running for checks to succeed.
      </p>
    </fieldset>
  );
}
