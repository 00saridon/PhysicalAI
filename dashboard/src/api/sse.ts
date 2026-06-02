// Minimal SSE client over fetch().
//
// We can't use the native EventSource because it cannot send custom request
// headers — and ngrok-free's browser-warning interstitial is only bypassed when
// the `ngrok-skip-browser-warning` header is present. EventSource therefore gets
// the warning HTML (no CORS headers) → the SSE stream is blocked. fetch() lets
// us attach the header, so the stream works through ngrok, Railway, localhost,
// and the Vite dev proxy alike.

export interface SSEEvent {
  event: string
  data: string
  id: string | null
}

export interface SSEOptions {
  signal: AbortSignal
  onMessage: (e: SSEEvent) => void
  onOpen?: () => void
  /** reconnect=true → transport dropped (caller should retry); false → server-sent terminal (done/error) */
  onClose?: (reconnect: boolean) => void
}

export async function streamSSE(url: string, opts: SSEOptions): Promise<void> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'text/event-stream', 'ngrok-skip-browser-warning': 'true' },
      cache: 'no-store',
      signal: opts.signal,
    })
  } catch {
    opts.onClose?.(true)
    return
  }
  if (!res.ok || !res.body) {
    opts.onClose?.(true)
    return
  }
  opts.onOpen?.()

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        opts.onClose?.(true) // server closed the connection unexpectedly → reconnect
        return
      }
      buf += decoder.decode(value, { stream: true })
      let sep: number
      // SSE events are separated by a blank line
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, sep)
        buf = buf.slice(sep + 2)
        const e = parseBlock(block)
        opts.onMessage(e)
        if (e.event === 'done' || e.event === 'error') {
          opts.onClose?.(false) // server-sent terminal — do not reconnect
          return
        }
      }
    }
  } catch {
    opts.onClose?.(true) // aborted (cleanup) or read error; caller checks its cancel flag
  }
}

function parseBlock(block: string): SSEEvent {
  let event = 'message'
  let id: string | null = null
  const data: string[] = []
  for (const raw of block.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    if (!line || line.startsWith(':')) continue // blank or comment (e.g. keep-alive)
    const ci = line.indexOf(':')
    const field = ci < 0 ? line : line.slice(0, ci)
    let val = ci < 0 ? '' : line.slice(ci + 1)
    if (val.startsWith(' ')) val = val.slice(1)
    if (field === 'event') event = val
    else if (field === 'data') data.push(val)
    else if (field === 'id') id = val
  }
  return { event, data: data.join('\n'), id }
}
