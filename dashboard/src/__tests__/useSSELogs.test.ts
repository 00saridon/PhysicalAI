import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { SSEOptions } from '../api/sse'

// Capture the streamSSE handlers so tests can drive onOpen/onMessage directly.
let captured: SSEOptions | null = null
vi.mock('../api/sse', () => ({
  streamSSE: vi.fn((_url: string, opts: SSEOptions) => {
    captured = opts
    opts.onOpen?.()
    return Promise.resolve()
  }),
}))

import { useSSELogs, RESUBSCRIBE_MS } from '../hooks/useSSELogs'

beforeEach(() => {
  captured = null
})

function sendLog(line: string, id: string | null) {
  act(() => {
    captured!.onMessage({ event: 'log', data: JSON.stringify({ line, ts: 1 }), id })
  })
}

describe('useSSELogs', () => {
  it('starts with empty lines', () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    expect(result.current.lines).toEqual([])
  })

  it('appends log lines from SSE events', () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    sendLog('[RL] Step 100 | rew=-0.04', '1')
    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0].text).toBe('[RL] Step 100 | rew=-0.04')
    expect(result.current.lines[0].level).toBe('RL')
  })

  it('dedupes replayed lines by SSE id (backfill on reconnect)', () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    sendLog('a', '1')
    sendLog('b', '2')
    sendLog('a', '1') // replayed backfill — same id, must be ignored
    expect(result.current.lines.map(l => l.text)).toEqual(['a', 'b'])
  })

  it('fires onTerminal on done/error events', () => {
    const onTerminal = vi.fn()
    renderHook(() => useSSELogs('/api/logs/stream', onTerminal))
    act(() => { captured!.onMessage({ event: 'done', data: '{}', id: null }) })
    expect(onTerminal).toHaveBeenCalledTimes(1)
  })

  it('resubscribes after a stage ends so later stages keep streaming', async () => {
    vi.useFakeTimers()
    try {
      const { streamSSE } = await import('../api/sse')
      const calls = vi.mocked(streamSSE).mock.calls.length
      const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
      expect(vi.mocked(streamSSE).mock.calls.length).toBe(calls + 1)
      // server sends ENV's done and closes the per-stage stream
      act(() => { captured!.onMessage({ event: 'done', data: '{"stage":"env","exit_code":0}', id: null }) })
      act(() => { captured!.onClose?.(false) })
      expect(result.current.connected).toBe(false)
      act(() => { vi.advanceTimersByTime(RESUBSCRIBE_MS) })
      expect(vi.mocked(streamSSE).mock.calls.length).toBe(calls + 2)
      expect(result.current.connected).toBe(true)
      sendLog('[COLLECT] episode 1', '9')       // next stage's logs arrive on the new stream
      expect(result.current.lines.map(l => l.text)).toEqual(['[COLLECT] episode 1'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps max 200 lines', () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    act(() => {
      for (let i = 0; i < 250; i++) {
        captured!.onMessage({ event: 'log', data: JSON.stringify({ line: `line ${i}`, ts: i }), id: String(i) })
      }
    })
    expect(result.current.lines).toHaveLength(200)
    expect(result.current.lines[199].text).toBe('line 249')
  })
})
