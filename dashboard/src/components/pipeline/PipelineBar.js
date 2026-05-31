import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StageButton } from './StageButton';
export function PipelineBar({ stages, onRun, disabled }) {
    const doneCount = stages.filter(s => s.status === 'done').length;
    const progress = Math.round((doneCount / stages.length) * 100);
    return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted", children: "Pipeline Control" }), _jsxs("span", { className: "text-[10px] font-bold text-nvidia", children: [doneCount, "/", stages.length, " \uC644\uB8CC \u00B7 ", progress, "%"] })] }), _jsxs("div", { className: "flex items-start justify-between relative", children: [_jsx("div", { className: "absolute top-5 left-[10%] right-[10%] h-0.5 bg-border" }), doneCount > 0 && (_jsx("div", { className: "absolute top-5 left-[10%] h-0.5 bg-nvidia/50 transition-all duration-500", style: { width: `${(doneCount / stages.length) * 80}%` } })), stages.map((stage) => (_jsx(StageButton, { stage: stage, onRun: onRun, disabled: disabled }, stage.id)))] })] }));
}
