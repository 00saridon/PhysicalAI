import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { clsx } from 'clsx';
import { LogPanel } from '../components/monitoring/LogPanel';
import { useSSELogs } from '../hooks/useSSELogs';
import { useSSEMetrics } from '../hooks/useSSEMetrics';
export function Training() {
    const [metric, setMetric] = useState('rew_mean');
    const { lines, connected } = useSSELogs('/api/logs/stream');
    const { points } = useSSEMetrics('/api/metrics/stream');
    const rlPoints = points.filter(p => p.stage === 'rl' && p.rew_mean !== undefined);
    const ilPoints = points.filter(p => p.stage === 'il' && p.loss !== undefined);
    const filtered = metric === 'rew_mean' ? rlPoints : ilPoints;
    const lastRew = rlPoints[rlPoints.length - 1]?.rew_mean;
    const lastLoss = ilPoints[ilPoints.length - 1]?.loss;
    const lastRlStep = rlPoints[rlPoints.length - 1]?.step;
    const lastIlEpoch = ilPoints[ilPoints.length - 1]?.step;
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-5 flex flex-col gap-4", children: [_jsx("div", { className: "grid grid-cols-4 gap-3", children: [
                    { label: 'RL Reward', value: lastRew !== undefined ? lastRew.toFixed(4) : '—', sub: lastRlStep ? `Step ${lastRlStep.toLocaleString()}` : 'Not started', color: 'text-violet-400' },
                    { label: 'IL Loss', value: lastLoss !== undefined ? lastLoss.toFixed(4) : '—', sub: lastIlEpoch ? `Epoch ${lastIlEpoch}` : 'Not started', color: 'text-sky-400' },
                    { label: 'RL Points', value: rlPoints.length, sub: 'collected', color: 'text-slate-300' },
                    { label: 'IL Points', value: ilPoints.length, sub: 'collected', color: 'text-slate-300' },
                ].map(k => (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-[10px] font-bold text-muted uppercase tracking-widest mb-1", children: k.label }), _jsx("p", { className: `text-2xl font-bold ${k.color}`, children: k.value }), _jsx("p", { className: "text-[10px] text-muted mt-0.5", children: k.sub })] }, k.label))) }), _jsxs("div", { className: "bg-panel border border-border rounded-xl p-4 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-bold text-muted uppercase tracking-widest", children: "Training Metrics" }), _jsx("div", { className: "flex gap-1", children: ['rew_mean', 'loss'].map(m => (_jsx("button", { onClick: () => setMetric(m), className: clsx('text-[10px] font-bold px-3 py-1 rounded transition-colors', metric === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'), children: m === 'rew_mean' ? '▶ RL Reward' : '📉 IL Loss' }, m))) })] }), _jsx("div", { className: "h-64", children: filtered.length === 0 ? (_jsx("div", { className: "h-full flex items-center justify-center text-slate-600 text-xs", children: metric === 'rew_mean' ? 'RL 스테이지를 실행하면 리워드 곡선이 표시됩니다' : 'IL 스테이지를 실행하면 Loss 곡선이 표시됩니다' })) : (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: filtered, margin: { top: 4, right: 16, bottom: 0, left: -10 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#2d3148" }), _jsx(XAxis, { dataKey: "step", stroke: "#475569", tick: { fontSize: 10 }, label: { value: metric === 'rew_mean' ? 'Step' : 'Epoch', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: '#64748b' } }), _jsx(YAxis, { stroke: "#475569", tick: { fontSize: 10 } }), _jsx(Tooltip, { contentStyle: { background: '#1a1d2e', border: '1px solid #2d3148', fontSize: 11 }, labelStyle: { color: '#94a3b8' } }), _jsx(Legend, { wrapperStyle: { fontSize: 10, color: '#94a3b8' } }), _jsx(Line, { type: "monotone", dataKey: metric, name: metric === 'rew_mean' ? 'Reward Mean' : 'Loss', stroke: metric === 'rew_mean' ? '#a78bfa' : '#38bdf8', dot: false, strokeWidth: 2, isAnimationActive: false })] }) })) })] }), _jsx(LogPanel, { lines: lines, connected: connected })] }));
}
