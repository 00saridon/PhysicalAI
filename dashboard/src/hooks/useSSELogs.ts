import { useEffect, useRef, useState } from 'react'
import type { LogLine } from '../types/pipeline'
import { parseLogLevel } from '../types/pipeline'
import { streamSSE } from '../api/sse'

const MAX_LINES = 200

export function useSSELogs(
  url: string,
  onTerminal?: () => void,
): { lines: LogLine[]; connected: boolean } {
  const [lines, setLines] = useState<LogLine[]>([])
  const [connected, setConnected] = useState(false)
  // Keep the latest callback without re-subscribing the stream every render.
  const onTerminalRef = useRef(onTerminal)
  onTerminalRef.current = onTerminal
  // The server backfills recent lines on every (re)subscribe, so a reconnect
  // replays lines we already have. Dedupe on the SSE id to keep appends idempotent.
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
          if (e.event === 'log') {
            if (e.id) {
              if (seen.current.has(e.id)) return
              seen.current.add(e.id)
            }
            try {
              const { line, ts } = JSON.parse(e.data) as { line: string; ts: number }
              setLines(prev => {
                const next = [...prev, { ts, level: parseLogLevel(line), text: line }]
                return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
              })
            } catch {}
          } else if (e.event === 'done' || e.event === 'error') {
            onTerminalRef.current?.() // stage finished/failed — let callers flip status now
          }
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

  return { lines, connected }
}
