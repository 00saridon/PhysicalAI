import { useEffect, useRef, useState } from 'react';
import { parseLogLevel } from '../types/pipeline';
const MAX_LINES = 200;
export function useSSELogs(url) {
    const [lines, setLines] = useState([]);
    const [connected, setConnected] = useState(false);
    const retryDelay = useRef(1000);
    const esRef = useRef(null);
    useEffect(() => {
        let cancelled = false;
        function connect() {
            if (cancelled)
                return;
            const es = new EventSource(url);
            esRef.current = es;
            es.addEventListener('log', (e) => {
                try {
                    const { line, ts } = JSON.parse(e.data);
                    setLines(prev => {
                        const next = [...prev, { ts, level: parseLogLevel(line), text: line }];
                        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
                    });
                }
                catch { }
            });
            es.addEventListener('done', () => {
                setConnected(false);
                es.close();
                retryDelay.current = 1000;
            });
            es.addEventListener('error', () => {
                setConnected(false);
                es.close();
            });
            es.onerror = () => {
                setConnected(false);
                es.close();
                if (!cancelled) {
                    setTimeout(connect, Math.min(retryDelay.current, 4000));
                    retryDelay.current = Math.min(retryDelay.current * 2, 4000);
                }
            };
            es.onopen = () => {
                setConnected(true);
                retryDelay.current = 1000;
            };
        }
        connect();
        return () => {
            cancelled = true;
            esRef.current?.close();
        };
    }, [url]);
    return { lines, connected };
}
