import { jsx as _jsx } from "react/jsx-runtime";
import { clsx } from 'clsx';
const STYLES = {
    done: 'bg-emerald-900 text-emerald-400',
    running: 'bg-indigo-900 text-indigo-300 animate-pulse',
    pending: 'bg-slate-800 text-slate-500',
    error: 'bg-red-950 text-red-400',
};
export function StatusBadge({ status, className }) {
    return (_jsx("span", { className: clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-bold', STYLES[status], className), children: status }));
}
