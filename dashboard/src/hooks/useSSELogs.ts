import { useEffect, useRef, useState } from 'react'
import type { LogLine } from '../types/pipeline'
import { parseLogLevel } from '../types/pipeline'
import { streamSSE } from '../api/sse'

const MAX_LINES = 200

/** Payload of a terminal pipeline event (a stage finishing, failing, or being
 *  stopped). Lets a caller chain stages (run the next one) or abort a sequence. */
export interface TerminalInfo {
  event: 'done' | 'error'
  stage: string | null
  exit_code: number
  stopped: boolean
}

export function useSSELogs(
  url: string,
  onTerminal?: (info: TerminalInfo) => void,
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
    // `active` guards every async callback so a torn-down effect (e.g. React
    // StrictMode's dev double-mount) can't update state or schedule reconnects.
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
          if (!active) return
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
            let info: TerminalInfo = { event: e.event, stage: null, exit_code: 0, stopped: false }
            try {
              const d = JSON.parse(e.data) as Partial<TerminalInfo>
              info = { event: e.event, stage: d.stage ?? null, exit_code: d.exit_code ?? 0, stopped: !!d.stopped }
            } catch { /* keep defaults */ }
            onTerminalRef.current?.(info)
          }
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

  return { lines, connected }
}
