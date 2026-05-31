import { useEffect, useState } from 'react';
const MAX_POINTS = 500;
export function useSSEMetrics(url) {
    const [points, setPoints] = useState([]);
    useEffect(() => {
        let cancelled = false;
        let es;
        function connect() {
            if (cancelled)
                return;
            es = new EventSource(url);
            es.addEventListener('metric', (e) => {
                try {
                    const point = JSON.parse(e.data);
                    setPoints(prev => {
                        const next = [...prev, point];
                        return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
                    });
                }
                catch { }
            });
            es.onerror = () => {
                es.close();
                if (!cancelled)
                    setTimeout(connect, 2000);
            };
        }
        connect();
        return () => {
            cancelled = true;
            es?.close();
        };
    }, [url]);
    return { points };
}
