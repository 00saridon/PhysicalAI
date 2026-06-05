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
    // `active` guards every async callback so a torn-down effect (React StrictMode
    // dev double-mount, navigation) can't update state or schedule reconnects.
    let active = true
    let retry = 1000
    let timer: ReturnType<typeof setTimeout> | undefined
    let ac: AbortController | null = null

    const connect = () => {
      if (!active) return
      ac = new AbortController()
      void streamSSE(url, {
        signal: ac.signal,
        onOpen: () => { if (active) { setConnected(true); retry = 1000 } },
        onMessage: (e) => {
          if (!active || e.event !== 'metric') return
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
          if (!active) return
          setConnected(false)
          if (reconnect) {
            timer = setTimeout(connect, Math.min(retry, 4000))
            retry = Math.min(retry * 2, 4000)
          }
        },
      })
    }

    connect()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      ac?.abort()
    }
  }, [url])

  return { points, connected }
}
