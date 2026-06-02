import { useEffect, useRef, useState } from 'react'
import type { MetricPoint } from '../types/pipeline'

const MAX_POINTS = 500

export function useSSEMetrics(url: string): { points: MetricPoint[]; connected: boolean } {
  const [points, setPoints] = useState<MetricPoint[]>([])
  const [connected, setConnected] = useState(false)
  const retryDelay = useRef(1000)
  const esRef = useRef<EventSource | null>(null)
  // The server backfills history on every (re)subscribe, so a reconnect replays
  // points we already have. Track seen (stage:step) keys to keep appends idempotent.
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return
      const es = new EventSource(url)
      esRef.current = es

      es.addEventListener('metric', (e: MessageEvent) => {
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
      })

      // Server-sent terminal events: the stage finished or failed. Stop here —
      // closing manually means onerror won't fire, so we don't reconnect.
      es.addEventListener('done', () => {
        setConnected(false)
        es.close()
        retryDelay.current = 1000
      })
      es.addEventListener('error', () => {
        setConnected(false)
        es.close()
      })

      // Native transport failure (connection drop): retry with exponential backoff.
      es.onerror = () => {
        setConnected(false)
        es.close()
        if (!cancelled) {
          setTimeout(connect, Math.min(retryDelay.current, 4000))
          retryDelay.current = Math.min(retryDelay.current * 2, 4000)
        }
      }

      es.onopen = () => {
        setConnected(true)
        retryDelay.current = 1000
      }
    }

    connect()
    return () => {
      cancelled = true
      esRef.current?.close()
    }
  }, [url])

  return { points, connected }
}
