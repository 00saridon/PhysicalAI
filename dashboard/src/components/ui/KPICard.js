import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { clsx } from 'clsx';
const SUB_COLORS = {
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    muted: 'text-slate-500',
};
export function KPICard({ label, value, sub, subColor = 'muted' }) {
    return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs font-semibold text-muted uppercase tracking-wide mb-2", children: label }), _jsx("p", { className: "text-2xl font-bold text-slate-100 mb-1", children: value }), sub && _jsx("p", { className: clsx('text-xs', SUB_COLORS[subColor]), children: sub })] }));
}
