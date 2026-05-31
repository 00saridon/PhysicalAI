import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { api } from '../../api/client';
const ICON = {
    onnx: '🧠', hdf5: '📦', pt: '💾', zip: '🗜',
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
export function ArtifactList({ artifacts }) {
    if (artifacts.length === 0) {
        return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs font-bold text-muted uppercase tracking-widest mb-3", children: "Artifacts" }), _jsx("p", { className: "text-slate-600 text-xs", children: "No artifacts yet. Run the export stage." })] }));
    }
    return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-4", children: [_jsx("p", { className: "text-xs font-bold text-muted uppercase tracking-widest mb-3", children: "Artifacts" }), _jsx("div", { className: "flex flex-col gap-2", children: artifacts.map(art => (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2 bg-[#0d1117] rounded-lg border border-border", children: [_jsx("span", { className: "text-xl", children: ICON[art.type] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-semibold text-slate-200 truncate", children: art.name }), _jsx("p", { className: "text-[10px] text-slate-500", children: art.path })] }), _jsx("span", { className: "text-xs text-slate-500 flex-shrink-0", children: formatBytes(art.size_bytes) }), _jsx("a", { href: api.artifactDownloadUrl(art.id), download: art.name, className: "text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors", children: "\u2193" })] }, art.id))) })] }));
}
