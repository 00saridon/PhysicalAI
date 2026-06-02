import { useEffect, useRef, useState } from 'react'
import type { MetricPoint } from '../types/pipeline'
import { streamSSE } from '../api/sse'

const MAX_POINTS = 500

export function useSSEMetrics(url: string): { points: MetricPoint[]; connected: boolean } {
  const [points, setPoints] = useState<MetricPoint[]>([])
  const [connected, setConnected] = useState(false)
  // The server backfills history on every (re)subscribe, so a reconnect replays
  // points we already have. Track seen (stage:step) keys to keep appends idempotent.
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    let retryDelay = 1000

    function run() {
      if (cancelled) return
      streamSSE(url, {
        signal: ac.signal,
        onOpen: () => {
          setConnected(true)
          retryDelay = 1000
        },
        onMessage: (e) => {
          if (e.event !== 'metric') return
          try {
            const point = JSON.parse(e.data) as MetricPoint
            const key = `${point.stage}:${point.step}`
            if (seen.current.has(key)) return
            seen.current.add(key)
            setPoints(prev => {
              const next = [...prev, point]
              return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
            })
          } catch {}
        },
        onClose: (reconnect) => {
          setConnected(false)
          if (!cancelled && reconnect) {
            setTimeout(run, Math.min(retryDelay, 4000))
            retryDelay = Math.min(retryDelay * 2, 4000)
          }
        },
      })
    }

    run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [url])

  return { points, connected }
}
