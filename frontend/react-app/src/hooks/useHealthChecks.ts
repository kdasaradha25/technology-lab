import { useCallback, useRef, useState } from 'react'
import { checkEndpoint, ENDPOINT_KEYS, type CheckResult, type EndpointKey } from '../api/healthApi'

type Results = Partial<Record<EndpointKey, CheckResult>>

/** Runs health checks on demand (never polls) and keeps the latest result per endpoint. */
export function useHealthChecks(baseUrl: string, timeoutMs: number) {
  const [results, setResults] = useState<Results>({})
  const [loading, setLoading] = useState<Set<EndpointKey>>(new Set())
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [lastRun, setLastRun] = useState<EndpointKey[]>(ENDPOINT_KEYS)
  // Incremented on reset, so results from a previous backend are ignored when they arrive.
  const generation = useRef(0)

  const run = useCallback(
    async (keys: EndpointKey[]) => {
      const current = generation.current
      setLastRun(keys)
      setLoading((prev) => new Set([...prev, ...keys]))

      await Promise.all(
        keys.map(async (key) => {
          const result = await checkEndpoint(baseUrl, key, { timeoutMs })
          if (generation.current !== current) return
          setResults((prev) => ({ ...prev, [key]: result }))
          setLoading((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        }),
      )
      if (generation.current === current) setLastCheckedAt(new Date())
    },
    [baseUrl, timeoutMs],
  )

  const refresh = useCallback(() => run(lastRun), [run, lastRun])

  const reset = useCallback(() => {
    generation.current += 1
    setResults({})
    setLoading(new Set())
    setLastCheckedAt(null)
  }, [])

  return { results, loading, lastCheckedAt, run, refresh, reset }
}
