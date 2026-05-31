import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { clsx } from 'clsx';
import { useArtifacts } from '../hooks/usePipeline';
import { api } from '../api/client';
const ICON = {
    onnx: '🧠', hdf5: '📦', pt: '💾', zip: '🗜',
};
const TYPE_COLOR = {
    onnx: 'text-violet-400 bg-violet-950',
    hdf5: 'text-amber-400 bg-amber-950',
    pt: 'text-sky-400 bg-sky-950',
    zip: 'text-emerald-400 bg-emerald-950',
};
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 ** 2)
        return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3)
        return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
const ALL_TYPES = ['all', 'onnx', 'hdf5', 'pt', 'zip'];
export function Artifacts() {
    const { data: artifacts = [], isLoading } = useArtifacts();
    const [filter, setFilter] = useState('all');
    const displayed = filter === 'all' ? artifacts : artifacts.filter(a => a.type === filter);
    const totalSize = displayed.reduce((s, a) => s + a.size_bytes, 0);
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-5 flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center justify-between flex-wrap gap-2", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-bold text-slate-200", children: "Artifacts" }), _jsxs("p", { className: "text-xs text-muted mt-0.5", children: [displayed.length, "\uAC1C \uD30C\uC77C \u00B7 ", formatBytes(totalSize)] })] }), _jsx("div", { className: "flex gap-1", children: ALL_TYPES.map(t => (_jsx("button", { onClick: () => setFilter(t), className: clsx('text-[10px] font-bold px-2.5 py-1 rounded transition-colors uppercase', filter === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'), children: t === 'all' ? 'All' : t.toUpperCase() }, t))) })] }), _jsx("div", { className: "grid grid-cols-4 gap-3", children: ['onnx', 'hdf5', 'pt', 'zip'].map(t => {
                    const count = artifacts.filter(a => a.type === t).length;
                    const size = artifacts.filter(a => a.type === t).reduce((s, a) => s + a.size_bytes, 0);
                    return (_jsxs("button", { onClick: () => setFilter(t), className: clsx('bg-panel border rounded-xl p-4 text-left transition-colors', filter === t ? 'border-indigo-500' : 'border-border hover:border-slate-600'), children: [_jsx("p", { className: "text-lg mb-1", children: ICON[t] }), _jsx("p", { className: clsx('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded inline-block mb-2', TYPE_COLOR[t]), children: t.toUpperCase() }), _jsx("p", { className: "text-sm font-bold text-slate-200", children: count }), _jsx("p", { className: "text-[10px] text-muted", children: formatBytes(size) })] }, t));
                }) }), _jsxs("div", { className: "bg-panel border border-border rounded-xl p-4 flex flex-col gap-2", children: [_jsx("p", { className: "text-xs font-bold text-muted uppercase tracking-widest mb-1", children: filter === 'all' ? '전체 목록' : `${filter.toUpperCase()} 파일` }), isLoading ? (_jsx("p", { className: "text-slate-600 text-xs py-4 text-center", children: "\uB85C\uB529 \uC911..." })) : displayed.length === 0 ? (_jsxs("div", { className: "py-8 text-center", children: [_jsx("p", { className: "text-slate-500 text-sm mb-1", children: "\uD83D\uDCED \uD30C\uC77C \uC5C6\uC74C" }), _jsx("p", { className: "text-slate-600 text-xs", children: "export \uC2A4\uD14C\uC774\uC9C0\uB97C \uC2E4\uD589\uD558\uBA74 \uD30C\uC77C\uC774 \uC0DD\uC131\uB429\uB2C8\uB2E4" })] })) : (displayed.map(art => (_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 bg-[#0d1117] rounded-lg border border-border", children: [_jsx("span", { className: "text-xl", children: ICON[art.type] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-semibold text-slate-200 truncate", children: art.name }), _jsx("p", { className: "text-[10px] text-slate-500", children: art.path })] }), _jsx("span", { className: clsx('text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', TYPE_COLOR[art.type]), children: art.type.toUpperCase() }), _jsx("span", { className: "text-xs text-slate-500 flex-shrink-0 w-16 text-right", children: formatBytes(art.size_bytes) }), _jsx("a", { href: api.artifactDownloadUrl(art.id), download: art.name, className: "text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors flex-shrink-0", children: "\u2193" })] }, art.id))))] })] }));
}
