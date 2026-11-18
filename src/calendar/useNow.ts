import { useEffect, useState } from 'react'

/**
 * The current time as state, refreshed on an interval. Views use it to decide
 * what is overdue without reading the clock during render.
 */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs)

    return () => window.clearInterval(interval)
  }, [intervalMs])

  return now
}
