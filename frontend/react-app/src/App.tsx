import { useMemo, useState } from 'react'
import { ENDPOINT_KEYS, summarize } from './api/healthApi'
import { BackendSelector } from './components/BackendSelector'
import { CheckControls } from './components/CheckControls'
import { ResultCard } from './components/ResultCard'
import { SummaryPanel } from './components/SummaryPanel'
import { BACKEND_PRESETS, REQUEST_TIMEOUT_MS } from './config/backends'
import { useHealthChecks } from './hooks/useHealthChecks'

export default function App() {
  const [url, setUrl] = useState(BACKEND_PRESETS[0].url)
  const { results, loading, lastCheckedAt, run, refresh, reset } = useHealthChecks(url, REQUEST_TIMEOUT_MS)
  const summary = useMemo(() => summarize(results), [results])

  const changeUrl = (next: string) => {
    setUrl(next)
    reset() // results belong to the previous backend
  }

  return (
    <main className="container">
      <header className="page-header">
        <h1>Backend &amp; Database Health Monitor</h1>
        <p>Check the API, application and database health of any Technology Lab backend.</p>
      </header>

      <BackendSelector presets={BACKEND_PRESETS} url={url} onUrlChange={changeUrl} />
      <CheckControls loading={loading} lastCheckedAt={lastCheckedAt} onRun={run} onRefresh={refresh} />
      <SummaryPanel
        summary={summary}
        loading={{ api: loading.has('api'), app: loading.has('app'), db: loading.has('db') }}
      />

      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="section-title">Results</h2>
        <div className="results">
          {ENDPOINT_KEYS.map((key) => (
            <ResultCard key={key} endpoint={key} result={results[key]} loading={loading.has(key)} />
          ))}
        </div>
      </section>
    </main>
  )
}
