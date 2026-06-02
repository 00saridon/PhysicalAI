import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSSELogs } from '../hooks/useSSELogs'

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  onopen: (() => void) | null = null
  _handlers: Record<string, (e: MessageEvent) => void> = {}
  addEventListener = vi.fn((type: string, handler: (e: MessageEvent) => void) => {
    this._handlers[type] = handler
  })
  _logHandler: ((e: MessageEvent) => void) | null = null
  close = vi.fn()

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }
}

beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
})

describe('useSSELogs', () => {
  it('starts with empty lines and connected=false', () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    expect(result.current.lines).toEqual([])
  })

  it('appends log lines from SSE events', async () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    const es = MockEventSource.instances[0]
    act(() => {
      es._handlers['log']?.({ data: JSON.stringify({ line: '[RL] Step 100 | rew=-0.04', ts: 1000 }) } as MessageEvent)
    })
    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0].text).toBe('[RL] Step 100 | rew=-0.04')
    expect(result.current.lines[0].level).toBe('RL')
  })

  it('dedupes replayed lines by SSE id (backfill on reconnect)', async () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    const es = MockEventSource.instances[0]
    const send = (line: string, id: string) =>
      es._handlers['log']?.({ data: JSON.stringify({ line, ts: 1 }), lastEventId: id } as MessageEvent)
    act(() => {
      send('a', '1')
      send('b', '2')
      send('a', '1') // replayed backfill — same id, must be ignored
    })
    expect(result.current.lines.map(l => l.text)).toEqual(['a', 'b'])
  })

  it('keeps max 200 lines', async () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    const es = MockEventSource.instances[0]
    act(() => {
      for (let i = 0; i < 250; i++) {
        es._handlers['log']?.({ data: JSON.stringify({ line: `line ${i}`, ts: i }) } as MessageEvent)
      }
    })
    expect(result.current.lines).toHaveLength(200)
    expect(result.current.lines[199].text).toBe('line 249')
  })
})
