import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
const LEVEL_COLOR = {
    INFO: 'text-indigo-300',
    WARN: 'text-amber-400',
    ERROR: 'text-red-400',
    RL: 'text-violet-400',
    IL: 'text-sky-400',
    RAW: 'text-slate-400',
};
export function LogPanel({ lines, connected }) {
    const bottomRef = useRef(null);
    const containerRef = useRef(null);
    const autoScroll = useRef(true);
    useEffect(() => {
        if (autoScroll.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [lines]);
    function handleScroll() {
        const el = containerRef.current;
        if (!el)
            return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        autoScroll.current = atBottom;
    }
    return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-4 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-bold text-muted uppercase tracking-widest", children: "Live Log" }), _jsx("span", { className: clsx('text-[10px] font-bold px-2 py-0.5 rounded', connected ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-500'), children: connected ? 'LIVE' : 'OFFLINE' })] }), _jsxs("div", { ref: containerRef, onScroll: handleScroll, className: "bg-[#0d1117] rounded-md p-3 font-mono text-[11px] h-36 overflow-y-auto flex flex-col gap-0.5", children: [lines.map((line, i) => (_jsxs("div", { className: "flex gap-2", children: [_jsx("span", { className: "text-slate-600 flex-shrink-0", children: new Date(line.ts * 1000).toLocaleTimeString() }), _jsxs("span", { className: clsx('flex-shrink-0', LEVEL_COLOR[line.level]), children: ["[", line.level, "]"] }), _jsx("span", { className: "text-slate-300 break-all", children: line.text })] }, i))), _jsx("div", { ref: bottomRef })] })] }));
}
