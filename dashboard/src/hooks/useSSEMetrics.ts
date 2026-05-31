import { useEffect, useState } from 'react'
import type { MetricPoint } from '../types/pipeline'

const MAX_POINTS = 500

export function useSSEMetrics(url: string): { points: MetricPoint[] } {
  const [points, setPoints] = useState<MetricPoint[]>([])

  useEffect(() => {
    let cancelled = false
    let es: EventSource

    function connect() {
      if (cancelled) return
      es = new EventSource(url)
      es.addEventListener('metric', (e: MessageEvent) => {
        try {
          const point = JSON.parse(e.data) as MetricPoint
          setPoints(prev => {
            const next = [...prev, point]
            return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
          })
        } catch {}
      })
      es.onerror = () => {
        es.close()
        if (!cancelled) setTimeout(connect, 2000)
      }
    }

    connect()
    return () => {
      cancelled = true
      es?.close()
    }
  }, [url])

  return { points }
}
