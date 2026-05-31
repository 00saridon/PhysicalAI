import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { usePipelineStatus, useRunStage } from '../hooks/usePipeline';
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 ** 2)
        return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3)
        return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
function formatDate(ts) {
    return new Date(ts * 1000).toLocaleString();
}
function EpisodeRow({ demo }) {
    const ep = demo.name.match(/episode_(\d+)/)?.[1] ?? '?';
    return (_jsxs("div", { className: "flex items-center gap-4 px-4 py-3 bg-[#0d1117] rounded-lg border border-border", children: [_jsx("span", { className: "text-xl", children: "\uD83C\uDFAC" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-semibold text-slate-200", children: demo.name }), _jsx("p", { className: "text-[10px] text-slate-500", children: demo.path })] }), _jsxs("div", { className: "text-right flex-shrink-0", children: [_jsxs("p", { className: "text-xs text-slate-400", children: ["Episode ", ep] }), _jsx("p", { className: "text-[10px] text-slate-600", children: formatDate(demo.created_at) })] }), _jsx("span", { className: "text-xs text-slate-500 flex-shrink-0 w-16 text-right", children: formatBytes(demo.size_bytes) })] }));
}
export function Demos() {
    const { data: demos = [], isLoading } = useQuery({
        queryKey: ['demos'],
        queryFn: api.getDemos,
        refetchInterval: 5000,
    });
    const { data: status } = usePipelineStatus();
    const { mutate: runStage, isPending } = useRunStage();
    const totalSize = demos.reduce((s, d) => s + d.size_bytes, 0);
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-5 flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-bold text-slate-200", children: "Demo Datasets" }), _jsx("p", { className: "text-xs text-muted mt-0.5", children: demos.length > 0
                                    ? `${demos.length}개 에피소드 · 총 ${formatBytes(totalSize)}`
                                    : '수집된 데모가 없습니다' })] }), _jsx("button", { onClick: () => runStage({ stage: 'collect' }), disabled: status?.running || isPending, className: `text-xs font-semibold px-4 py-2 rounded-md transition-colors ${status?.running || isPending
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`, children: status?.running && status.stage === 'collect' ? '⟳ Collecting...' : '▶ Collect 실행' })] }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: [
                    { icon: '🎮', title: 'Random', desc: '랜덤 액션으로 빠르게 데이터 수집' },
                    { icon: '🕹', title: 'Teleop', desc: '키보드로 직접 로봇 조종' },
                    { icon: '🤖', title: 'Rollout', desc: '학습된 정책으로 자동 수집' },
                ].map(m => (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-4 text-center", children: [_jsx("p", { className: "text-2xl mb-2", children: m.icon }), _jsx("p", { className: "text-xs font-bold text-slate-300", children: m.title }), _jsx("p", { className: "text-[10px] text-muted mt-1", children: m.desc })] }, m.title))) }), _jsxs("div", { className: "bg-panel border border-border rounded-xl p-4 flex flex-col gap-2", children: [_jsx("p", { className: "text-xs font-bold text-muted uppercase tracking-widest mb-1", children: "Episodes" }), isLoading ? (_jsx("p", { className: "text-slate-600 text-xs py-4 text-center", children: "\uB85C\uB529 \uC911..." })) : demos.length === 0 ? (_jsxs("div", { className: "py-8 text-center", children: [_jsx("p", { className: "text-slate-500 text-sm mb-1", children: "\uD83C\uDFAC \uC218\uC9D1\uB41C \uB370\uBAA8 \uC5C6\uC74C" }), _jsx("p", { className: "text-slate-600 text-xs", children: "\uC704 \"Collect \uC2E4\uD589\" \uBC84\uD2BC\uC73C\uB85C \uB370\uC774\uD130\uB97C \uC218\uC9D1\uD558\uC138\uC694" })] })) : (_jsx("div", { className: "flex flex-col gap-2", children: demos.map(d => _jsx(EpisodeRow, { demo: d }, d.path)) }))] })] }));
}
