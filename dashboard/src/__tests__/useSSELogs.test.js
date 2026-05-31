import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSELogs } from '../hooks/useSSELogs';
class MockEventSource {
    static instances = [];
    url;
    onmessage = null;
    onerror = null;
    onopen = null;
    _handlers = {};
    addEventListener = vi.fn((type, handler) => {
        this._handlers[type] = handler;
    });
    _logHandler = null;
    close = vi.fn();
    constructor(url) {
        this.url = url;
        MockEventSource.instances.push(this);
    }
}
beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
});
describe('useSSELogs', () => {
    it('starts with empty lines and connected=false', () => {
        const { result } = renderHook(() => useSSELogs('/api/logs/stream'));
        expect(result.current.lines).toEqual([]);
    });
    it('appends log lines from SSE events', async () => {
        const { result } = renderHook(() => useSSELogs('/api/logs/stream'));
        const es = MockEventSource.instances[0];
        act(() => {
            es._handlers['log']?.({ data: JSON.stringify({ line: '[RL] Step 100 | rew=-0.04', ts: 1000 }) });
        });
        expect(result.current.lines).toHaveLength(1);
        expect(result.current.lines[0].text).toBe('[RL] Step 100 | rew=-0.04');
        expect(result.current.lines[0].level).toBe('RL');
    });
    it('keeps max 200 lines', async () => {
        const { result } = renderHook(() => useSSELogs('/api/logs/stream'));
        const es = MockEventSource.instances[0];
        act(() => {
            for (let i = 0; i < 250; i++) {
                es._handlers['log']?.({ data: JSON.stringify({ line: `line ${i}`, ts: i }) });
            }
        });
        expect(result.current.lines).toHaveLength(200);
        expect(result.current.lines[199].text).toBe('line 249');
    });
});
