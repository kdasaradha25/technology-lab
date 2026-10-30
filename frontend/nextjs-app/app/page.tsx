import { HealthMonitor } from "@/components/HealthMonitor";
import styles from "./page.module.css";

// The page shell is a Server Component; only <HealthMonitor> runs in the browser,
// and it calls the backends directly (no API routes or proxy in this app).
export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Backend &amp; Database Health Monitor</h1>
        <p>Choose a Technology Lab backend and check its API, application and database health.</p>
      </header>
      <HealthMonitor />
    </main>
  );
}
