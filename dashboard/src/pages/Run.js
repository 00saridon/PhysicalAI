import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PipelineBar } from '../components/pipeline/PipelineBar';
import { usePipelineStatus, useRunStage } from '../hooks/usePipeline';
import { useSSELogs } from '../hooks/useSSELogs';
const STAGE_DEFS = [
    { id: 'env', name: 'ENV' },
    { id: 'collect', name: 'COLLECT' },
    { id: 'il', name: 'IL' },
    { id: 'rl', name: 'RL' },
    { id: 'export', name: 'EXPORT' },
];
const STAGE_DESC = {
    env: 'Isaac 환경 초기화 및 센서 설정 검증',
    collect: '랜덤/텔레오퍼레이션으로 데모 데이터 수집',
    il: 'BC(Behavioral Cloning)으로 초기 정책 학습',
    rl: 'PPO/SAC로 정책 파인튜닝',
    export: 'ONNX 정책 + HDF5 데이터셋 내보내기',
};
export function Run() {
    const { data: status } = usePipelineStatus();
    const { mutate: runStage, isPending } = useRunStage();
    const apiBase = (import.meta.env.VITE_API_URL ?? '') + '/api';
    const { lines, connected } = useSSELogs(`${apiBase}/logs/stream`);
    const stages = STAGE_DEFS.map(def => ({
        ...def,
        status: status?.stage === def.id ? 'running' : 'pending',
        detail: '',
    }));
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-5 flex flex-col gap-4", children: [_jsxs("div", { className: "bg-panel border border-border rounded-xl p-4 flex items-center gap-4", children: [_jsx("span", { className: `w-3 h-3 rounded-full flex-shrink-0 ${status?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}` }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold text-slate-200", children: status?.running ? `${status.stage?.toUpperCase()} 실행 중` : '대기 중 (Idle)' }), _jsx("p", { className: "text-xs text-muted", children: status?.running && status.stage ? STAGE_DESC[status.stage] : '아래 스테이지 버튼을 눌러 파이프라인을 시작하세요' })] }), status?.running && (_jsx("span", { className: "ml-auto text-xs font-bold px-3 py-1 rounded-full bg-emerald-900 text-emerald-300 animate-pulse", children: "RUNNING" }))] }), _jsx(PipelineBar, { stages: stages, onRun: id => runStage({ stage: id, validate: id === 'env' }), disabled: status?.running || isPending }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2", children: STAGE_DEFS.map(def => (_jsxs("div", { className: `bg-panel border rounded-lg p-3 text-center ${status?.stage === def.id ? 'border-indigo-500' : 'border-border'}`, children: [_jsx("p", { className: "text-xs font-bold text-slate-300 mb-1", children: def.name }), _jsx("p", { className: "text-[10px] text-muted leading-tight", children: STAGE_DESC[def.id] })] }, def.id))) }), _jsxs("div", { className: "bg-panel border border-border rounded-xl p-4 flex flex-col gap-3 flex-1 min-h-0", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-bold text-muted uppercase tracking-widest", children: "Live Log" }), _jsx("span", { className: `text-[10px] font-bold px-2 py-0.5 rounded ${connected ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-500'}`, children: connected ? 'LIVE' : 'OFFLINE' })] }), _jsx("div", { className: "bg-[#0d1117] rounded-md p-3 font-mono text-[11px] flex-1 min-h-[300px] overflow-y-auto flex flex-col gap-0.5", children: lines.length === 0 ? (_jsx("p", { className: "text-slate-600 m-auto text-xs", children: "\uC2A4\uD14C\uC774\uC9C0\uB97C \uC2E4\uD589\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uB85C\uADF8\uAC00 \uCD9C\uB825\uB429\uB2C8\uB2E4" })) : (lines.map((line, i) => (_jsxs("div", { className: "flex gap-2", children: [_jsx("span", { className: "text-slate-600 flex-shrink-0", children: new Date(line.ts * 1000).toLocaleTimeString() }), _jsx("span", { className: "text-slate-300 break-all", children: line.text })] }, i)))) })] })] }));
}
