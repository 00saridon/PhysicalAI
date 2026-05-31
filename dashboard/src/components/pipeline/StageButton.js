import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { clsx } from 'clsx';
const CIRCLE = {
    done: 'border-nvidia bg-[#0a1400] text-nvidia shadow-lg shadow-nvidia/20',
    running: 'border-nvidia bg-[#0a1400] text-nvidia animate-pulse shadow-lg shadow-nvidia/30',
    pending: 'border-slate-700 bg-slate-900 text-slate-600',
    error: 'border-red-500 bg-red-950 text-red-400',
};
const ICON = {
    done: '✓', running: '⟳', pending: '○', error: '✕',
};
export function StageButton({ stage, onRun, disabled }) {
    return (_jsxs("div", { className: "flex flex-col items-center gap-2 cursor-default", title: stage.detail, children: [_jsx("button", { onClick: () => onRun?.(stage.id), disabled: disabled || stage.status === 'running', className: clsx('w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all', CIRCLE[stage.status], !disabled && stage.status !== 'running' && 'hover:scale-110'), children: ICON[stage.status] }), _jsx("span", { className: "text-xs font-semibold text-slate-400", children: stage.name }), stage.detail && _jsx("span", { className: "text-[10px] text-slate-500", children: stage.detail })] }));
}
