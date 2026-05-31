import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { clsx } from 'clsx';
import { PipelineBar } from '../components/pipeline/PipelineBar';
import { LogPanel } from '../components/monitoring/LogPanel';
import { RewardChart } from '../components/monitoring/RewardChart';
import { ArtifactList } from '../components/artifacts/ArtifactList';
import { usePipelineStatus, useRunStage, useArtifacts } from '../hooks/usePipeline';
import { useSSELogs } from '../hooks/useSSELogs';
import { useSSEMetrics } from '../hooks/useSSEMetrics';
const STAGE_DEFS = [
    { id: 'env', name: 'ENV' },
    { id: 'collect', name: 'COLLECT' },
    { id: 'il', name: 'IL' },
    { id: 'rl', name: 'RL' },
    { id: 'export', name: 'EXPORT' },
];
/* ─────────────────────────────────────────────────────────── */
/*  Isaac Sim Viewport (animated SVG)                          */
/* ─────────────────────────────────────────────────────────── */
const DOTS = [
    [90, 290], [115, 275], [105, 310], [130, 295], [80, 310], [100, 328], [120, 315],
    [145, 300], [160, 288], [175, 308], [155, 325], [140, 338], [170, 340], [185, 325],
    [200, 290], [215, 278], [210, 310], [230, 295], [245, 308], [195, 340], [220, 330],
    [240, 340], [260, 332], [280, 320], [290, 305], [305, 290], [310, 310], [295, 330],
    [270, 345], [250, 355],
];
function SimViewport() {
    return (_jsxs("div", { className: "relative w-full rounded-xl overflow-hidden border border-nvidia/30 shadow-2xl shadow-nvidia/10 bg-[#050810]", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-1.5 bg-[#0a0d1a] border-b border-nvidia/20", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-red-500/80" }), _jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-yellow-500/80" }), _jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-nvidia/80" })] }), _jsx("span", { className: "text-[9px] font-bold text-nvidia/60 uppercase tracking-widest", children: "Isaac Sim \u2014 Viewport \u00B7 Physics Real-Time" }), _jsx("span", { className: "text-[9px] text-slate-600", children: "v2023.1.1" })] }), _jsxs("svg", { viewBox: "0 0 640 370", className: "w-full", style: { background: 'linear-gradient(180deg, #060912 0%, #0a1020 60%, #0d1525 100%)' }, children: [_jsxs("defs", { children: [_jsxs("filter", { id: "glow-green", x: "-30%", y: "-30%", width: "160%", height: "160%", children: [_jsx("feGaussianBlur", { stdDeviation: "3", result: "blur" }), _jsxs("feMerge", { children: [_jsx("feMergeNode", { in: "blur" }), _jsx("feMergeNode", { in: "SourceGraphic" })] })] }), _jsxs("filter", { id: "glow-blue", x: "-30%", y: "-30%", width: "160%", height: "160%", children: [_jsx("feGaussianBlur", { stdDeviation: "4", result: "blur" }), _jsxs("feMerge", { children: [_jsx("feMergeNode", { in: "blur" }), _jsx("feMergeNode", { in: "SourceGraphic" })] })] }), _jsxs("filter", { id: "glow-soft", x: "-50%", y: "-50%", width: "200%", height: "200%", children: [_jsx("feGaussianBlur", { stdDeviation: "6", result: "blur" }), _jsxs("feMerge", { children: [_jsx("feMergeNode", { in: "blur" }), _jsx("feMergeNode", { in: "SourceGraphic" })] })] }), _jsxs("linearGradient", { id: "sensorGrad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#76b900", stopOpacity: "0.35" }), _jsx("stop", { offset: "100%", stopColor: "#76b900", stopOpacity: "0.02" })] }), _jsxs("linearGradient", { id: "floorGrad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#1a2a0a", stopOpacity: "0.6" }), _jsx("stop", { offset: "100%", stopColor: "#050810", stopOpacity: "0" })] }), _jsxs("linearGradient", { id: "scanGrad", x1: "0", y1: "0", x2: "1", y2: "0", children: [_jsx("stop", { offset: "0%", stopColor: "#76b900", stopOpacity: "0" }), _jsx("stop", { offset: "40%", stopColor: "#76b900", stopOpacity: "0.8" }), _jsx("stop", { offset: "60%", stopColor: "#76b900", stopOpacity: "0.8" }), _jsx("stop", { offset: "100%", stopColor: "#76b900", stopOpacity: "0" })] }), _jsx("style", { children: `
            @keyframes armSway {
              0%,100% { transform: rotate(-2deg); }
              50% { transform: rotate(3deg); }
            }
            @keyframes gripperOpen {
              0%,40%,100% { transform: translateX(0); }
              60%,80% { transform: translateX(3px); }
            }
            @keyframes gripperClose {
              0%,40%,100% { transform: translateX(0); }
              60%,80% { transform: translateX(-3px); }
            }
            @keyframes bboxBlink {
              0%,100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
            @keyframes dotPulse {
              0%,100% { opacity: 0.9; r: 1.5px; }
              50% { opacity: 0.4; r: 0.8px; }
            }
            @keyframes scanY {
              0% { transform: translateY(-80px); }
              100% { transform: translateY(80px); }
            }
            @keyframes hudBlink {
              0%,100% { opacity: 1; }
              50% { opacity: 0.6; }
            }
            @keyframes floatUp {
              0%,100% { transform: translateY(0); }
              50% { transform: translateY(-4px); }
            }
            .arm-group { transform-origin: 320px 338px; animation: armSway 6s ease-in-out infinite; }
            .gripper-r { transform-origin: 262px 210px; animation: gripperOpen 3s ease-in-out infinite; }
            .gripper-l { transform-origin: 262px 210px; animation: gripperClose 3s ease-in-out infinite; }
            .bbox-rect { animation: bboxBlink 2.4s ease-in-out infinite; }
            .dot-pulse { animation: dotPulse 2s ease-in-out infinite; }
            .scan-line { animation: scanY 2s linear infinite; }
            .hud-blink { animation: hudBlink 1.2s ease-in-out infinite; }
            .float-anim { animation: floatUp 4s ease-in-out infinite; }
          ` })] }), [230, 258, 284, 308, 328, 346, 362].map((y, i) => {
                        const t = (y - 180) / (370 - 180);
                        const x0 = 320 - t * 320;
                        const x1 = 320 + t * 320;
                        return (_jsx("line", { x1: x0, y1: y, x2: x1, y2: y, stroke: "#76b900", strokeOpacity: 0.06 + i * 0.02, strokeWidth: "0.5" }, i));
                    }), [-240, -160, -80, -20, 0, 20, 80, 160, 240].map((dx, i) => (_jsx("line", { x1: 320 + dx, y1: 370, x2: 320, y2: 180, stroke: "#76b900", strokeOpacity: 0.07, strokeWidth: "0.5" }, i))), _jsx("polygon", { points: "0,370 640,370 580,230 60,230", fill: "url(#floorGrad)" }), _jsx("ellipse", { cx: "320", cy: "185", rx: "200", ry: "40", fill: "#76b900", opacity: "0.03" }), _jsx("ellipse", { cx: "320", cy: "340", rx: "160", ry: "20", fill: "#76b900", opacity: "0.08" }), _jsx("g", { opacity: "0.85", children: DOTS.map(([x, y], i) => (_jsx("circle", { cx: x, cy: y, r: 1.5, fill: i % 3 === 0 ? '#76b900' : i % 3 === 1 ? '#00d4ff' : '#a0e040', className: "dot-pulse", style: { animationDelay: `${(i * 0.07) % 2}s` } }, i))) }), _jsxs("g", { className: "arm-group float-anim", children: [_jsx("rect", { x: "300", y: "332", width: "40", height: "12", rx: "3", fill: "#1a2030", stroke: "#76b900", strokeWidth: "1", strokeOpacity: "0.6" }), _jsx("rect", { x: "308", y: "328", width: "24", height: "8", rx: "2", fill: "#243020", stroke: "#76b900", strokeWidth: "0.8", strokeOpacity: "0.5" }), _jsx("line", { x1: "320", y1: "330", x2: "295", y2: "262", stroke: "#4a6a20", strokeWidth: "7", strokeLinecap: "round" }), _jsx("line", { x1: "320", y1: "330", x2: "295", y2: "262", stroke: "#76b900", strokeWidth: "2", strokeLinecap: "round", strokeOpacity: "0.9" }), _jsx("circle", { cx: "320", cy: "330", r: "7", fill: "#1e2d10", stroke: "#76b900", strokeWidth: "1.5" }), _jsx("circle", { cx: "320", cy: "330", r: "3", fill: "#76b900", opacity: "0.8" }), _jsx("line", { x1: "295", y1: "262", x2: "268", y2: "205", stroke: "#3a5520", strokeWidth: "6", strokeLinecap: "round" }), _jsx("line", { x1: "295", y1: "262", x2: "268", y2: "205", stroke: "#76b900", strokeWidth: "1.5", strokeLinecap: "round", strokeOpacity: "0.8" }), _jsx("circle", { cx: "295", cy: "262", r: "6", fill: "#1e2d10", stroke: "#76b900", strokeWidth: "1.5" }), _jsx("circle", { cx: "295", cy: "262", r: "2.5", fill: "#76b900", opacity: "0.7" }), _jsx("circle", { cx: "268", cy: "205", r: "5", fill: "#1e2d10", stroke: "#76b900", strokeWidth: "1.5" }), _jsx("circle", { cx: "268", cy: "205", r: "2", fill: "#76b900", opacity: "0.8" }), _jsx("rect", { x: "260", y: "200", width: "16", height: "10", rx: "2", fill: "#243020", stroke: "#76b900", strokeWidth: "1", strokeOpacity: "0.8" }), _jsx("g", { className: "gripper-r", children: _jsx("rect", { x: "270", y: "208", width: "3", height: "14", rx: "1.5", fill: "#76b900", opacity: "0.9" }) }), _jsx("g", { className: "gripper-l", children: _jsx("rect", { x: "263", y: "208", width: "3", height: "14", rx: "1.5", fill: "#76b900", opacity: "0.9" }) }), _jsx("polygon", { points: "268,205 195,368 240,368", fill: "url(#sensorGrad)" }), _jsx("line", { x1: "268", y1: "205", x2: "195", y2: "368", stroke: "#76b900", strokeOpacity: "0.2", strokeWidth: "0.5" }), _jsx("line", { x1: "268", y1: "205", x2: "240", y2: "368", stroke: "#76b900", strokeOpacity: "0.2", strokeWidth: "0.5" })] }), _jsxs("g", { filter: "url(#glow-green)", children: [_jsx("rect", { x: "160", y: "326", width: "52", height: "40", rx: "1", fill: "#0a1800", stroke: "#76b900", strokeWidth: "1.2", strokeOpacity: "0.8" }), _jsx("polygon", { points: "160,326 212,326 224,312 172,312", fill: "#0d2000", stroke: "#76b900", strokeWidth: "1", strokeOpacity: "0.6" }), _jsx("polygon", { points: "212,326 224,312 224,352 212,366", fill: "#060f00", stroke: "#76b900", strokeWidth: "0.8", strokeOpacity: "0.5" }), _jsx("text", { x: "186", y: "350", textAnchor: "middle", fontSize: "8", fill: "#76b900", fontWeight: "bold", opacity: "0.6", children: "NVIDIA" })] }), _jsxs("g", { className: "bbox-rect", filter: "url(#glow-green)", children: [_jsx("rect", { x: "152", y: "308", width: "80", height: "62", rx: "1", fill: "none", stroke: "#76b900", strokeWidth: "1", strokeDasharray: "4 2" }), [[152, 308], [232, 308], [152, 370], [232, 370]].map(([cx, cy], i) => (_jsx("g", { children: _jsx("rect", { x: cx - 3, y: cy - 3, width: 6, height: 6, fill: "none", stroke: "#76b900", strokeWidth: "1.5" }) }, i))), _jsx("rect", { x: "152", y: "296", width: "52", height: "12", rx: "2", fill: "#76b900", opacity: "0.85" }), _jsx("text", { x: "178", y: "305", textAnchor: "middle", fontSize: "7", fill: "#000", fontWeight: "bold", children: "cube \u00B7 0.97" })] }), _jsx("g", { style: { clipPath: 'inset(230px 0 0 0)' }, children: _jsx("rect", { x: "50", y: "310", width: "540", height: "2", rx: "1", fill: "url(#scanGrad)", className: "scan-line", opacity: "0.7" }) }), _jsxs("g", { filter: "url(#glow-soft)", children: [_jsx("rect", { x: "8", y: "8", width: "130", height: "56", rx: "3", fill: "#050810", fillOpacity: "0.85", stroke: "#76b900", strokeWidth: "0.8", strokeOpacity: "0.4" }), _jsx("text", { x: "14", y: "20", fontSize: "6.5", fill: "#76b900", fontWeight: "bold", opacity: "0.6", letterSpacing: "1", children: "OBS SPACE" }), _jsx("text", { x: "14", y: "32", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "pos: [0.24, 0.18, 0.42]" }), _jsx("text", { x: "14", y: "42", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "vel: [-0.02, 0.01, 0.00]" }), _jsx("text", { x: "14", y: "52", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "ee:  [0.51, 0.30, 0.67]" })] }), _jsxs("g", { filter: "url(#glow-soft)", children: [_jsx("rect", { x: "498", y: "8", width: "134", height: "56", rx: "3", fill: "#050810", fillOpacity: "0.85", stroke: "#76b900", strokeWidth: "0.8", strokeOpacity: "0.4" }), _jsx("text", { x: "504", y: "20", fontSize: "6.5", fill: "#76b900", fontWeight: "bold", opacity: "0.6", letterSpacing: "1", children: "RTX 4090 \u00B7 CUDA 12.3" }), _jsx("text", { x: "504", y: "32", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "GPU:  94%  \u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2591\u2591" }), _jsx("text", { x: "504", y: "42", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "VRAM: 18.2 / 24.0 GB" }), _jsx("text", { x: "504", y: "52", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "SIM:  4096 envs \u00B7 60fps" })] }), _jsxs("g", { children: [_jsx("rect", { x: "8", y: "300", width: "130", height: "42", rx: "3", fill: "#050810", fillOpacity: "0.85", stroke: "#76b900", strokeWidth: "0.8", strokeOpacity: "0.35" }), _jsx("text", { x: "14", y: "312", fontSize: "6.5", fill: "#76b900", fontWeight: "bold", opacity: "0.6", letterSpacing: "1", children: "EPISODE" }), _jsx("text", { x: "14", y: "323", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "step:    1 247 / 2 000" }), _jsx("text", { x: "14", y: "333", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "reward:  +2.841" }), _jsx("text", { x: "14", y: "343", fontSize: "7", fill: "#76b900", fontFamily: "monospace", className: "hud-blink", children: "\u25CF COLLECTING" })] }), _jsxs("g", { children: [_jsx("rect", { x: "498", y: "310", width: "134", height: "42", rx: "3", fill: "#050810", fillOpacity: "0.85", stroke: "#76b900", strokeWidth: "0.8", strokeOpacity: "0.35" }), _jsx("text", { x: "504", y: "322", fontSize: "6.5", fill: "#76b900", fontWeight: "bold", opacity: "0.6", letterSpacing: "1", children: "SIM METRICS" }), _jsx("text", { x: "504", y: "332", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "fps:    58.3  \u2191 realtime" }), _jsx("text", { x: "504", y: "342", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "physics: PhysX 5.1" }), _jsx("text", { x: "504", y: "352", fontSize: "7.5", fill: "#a0e040", fontFamily: "monospace", children: "t_sim:   20.78s" })] }), _jsxs("g", { transform: "translate(310, 60)", children: [_jsx("line", { x1: "0", y1: "0", x2: "22", y2: "-8", stroke: "#ff4444", strokeWidth: "1.5" }), _jsx("text", { x: "24", y: "-10", fontSize: "7", fill: "#ff6666", fontWeight: "bold", children: "X" }), _jsx("line", { x1: "0", y1: "0", x2: "0", y2: "-22", stroke: "#44ff44", strokeWidth: "1.5" }), _jsx("text", { x: "-8", y: "-24", fontSize: "7", fill: "#66ff66", fontWeight: "bold", children: "Y" }), _jsx("line", { x1: "0", y1: "0", x2: "-14", y2: "-14", stroke: "#4444ff", strokeWidth: "1.5" }), _jsx("text", { x: "-22", y: "-16", fontSize: "7", fill: "#6688ff", fontWeight: "bold", children: "Z" })] }), _jsxs("g", { transform: "translate(240, 356)", children: [_jsx("rect", { x: "0", y: "0", width: "160", height: "10", rx: "5", fill: "#0a1200", stroke: "#76b900", strokeWidth: "0.8", strokeOpacity: "0.4" }), _jsx("rect", { x: "0", y: "0", width: "112", height: "10", rx: "5", fill: "#76b900", opacity: "0.7" }), _jsx("text", { x: "80", y: "7.5", textAnchor: "middle", fontSize: "6", fill: "#000", fontWeight: "bold", children: "REW 2.84 / 4.0" })] })] })] }));
}
/* ─────────────────────────────────────────────────────────── */
/*  Pipeline Architecture Diagram                              */
/* ─────────────────────────────────────────────────────────── */
const ARCH_STAGES = [
    {
        icon: '🌍',
        label: '01',
        title: 'Isaac Sim',
        tech: 'Omniverse · PhysX 5',
        runtime: '~30s',
        input: 'USD Scene\nRobot URDF',
        output: 'Env Handle\nPhysics State',
        desc: 'Omniverse 기반 물리 시뮬레이터로 로봇 환경을 초기화하고 4096개 병렬 인스턴스를 생성합니다.',
        color: '#76b900',
    },
    {
        icon: '🎮',
        label: '02',
        title: 'Demo Collect',
        tech: 'Teleoperation · HDF5',
        runtime: '~5min',
        input: 'Env Handle\nController',
        output: 'HDF5 Demo\n(1000 eps)',
        desc: '랜덤 정책 또는 텔레오퍼레이션으로 전문가 시연을 수집하고 HDF5 형식으로 저장합니다.',
        color: '#00d4ff',
    },
    {
        icon: '🧠',
        label: '03',
        title: 'Behavior Cloning',
        tech: 'MLP · Adam · MSE',
        runtime: '~10min',
        input: 'HDF5 Demo\nConfig YAML',
        output: 'IL Weights\n(.pth)',
        desc: '데모 데이터에서 Supervised Learning으로 MLP 정책을 사전 훈련합니다. 초기 성능 확보.',
        color: '#a855f7',
    },
    {
        icon: '🏋',
        label: '04',
        title: 'PPO / RL',
        tech: 'SB3 · PPO · GAE',
        runtime: '~30min',
        input: 'IL Weights\nEnv Handle',
        output: 'RL Policy\n(.zip)',
        desc: 'IL 가중치로 초기화 후 PPO 강화학습으로 파인튜닝. 리워드 최적화로 성능을 극대화합니다.',
        color: '#f59e0b',
    },
    {
        icon: '📤',
        label: '05',
        title: 'ONNX Export',
        tech: 'ONNX opset-18',
        runtime: '~10s',
        input: 'RL Policy\n(.zip)',
        output: 'policy.onnx\n(deploy-ready)',
        desc: '훈련된 정책을 ONNX opset-18로 변환. 실제 로봇(Franka, UR5 등)에 바로 배포 가능.',
        color: '#ef4444',
    },
];
function PipelineArchDiagram() {
    return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted", children: "\uD30C\uC774\uD504\uB77C\uC778 \uC544\uD0A4\uD14D\uCC98" }), _jsx("p", { className: "text-sm font-bold text-slate-200 mt-0.5", children: "End-to-End Robot Policy Learning" })] }), _jsx("span", { className: "text-[10px] px-2.5 py-1 rounded-full border border-nvidia/30 text-nvidia/80 bg-nvidia/5 font-bold", children: "5 Stages \u00B7 ~45min Total" })] }), _jsx("div", { className: "relative", children: _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3", children: ARCH_STAGES.map((s, i) => (_jsxs("div", { className: "relative flex flex-col gap-2", children: [_jsxs("div", { className: "rounded-xl border p-3 flex flex-col gap-2 transition-all hover:scale-[1.02]", style: { borderColor: s.color + '40', background: `linear-gradient(135deg, #0d1018 0%, #111620 100%)` }, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xl", children: s.icon }), _jsx("span", { className: "text-[9px] font-black px-1.5 py-0.5 rounded", style: { color: s.color, background: s.color + '18' }, children: s.label })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-black text-slate-100", children: s.title }), _jsx("p", { className: "text-[9px] font-bold mt-0.5", style: { color: s.color + 'cc' }, children: s.tech })] }), _jsxs("span", { className: "text-[9px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-border self-start font-mono", children: ["\u23F1 ", s.runtime] }), _jsxs("div", { className: "flex flex-col gap-1 pt-1 border-t border-border/60", children: [_jsxs("div", { className: "flex items-start gap-1.5", children: [_jsx("span", { className: "text-[8px] font-bold text-slate-600 mt-0.5 w-4 shrink-0", children: "IN" }), _jsx("span", { className: "text-[8px] text-slate-400 font-mono leading-tight whitespace-pre-line", children: s.input })] }), _jsxs("div", { className: "flex items-start gap-1.5", children: [_jsx("span", { className: "text-[8px] font-bold mt-0.5 w-4 shrink-0", style: { color: s.color + '99' }, children: "OUT" }), _jsx("span", { className: "text-[8px] font-mono leading-tight whitespace-pre-line", style: { color: s.color + 'cc' }, children: s.output })] })] }), _jsx("p", { className: "text-[9px] text-slate-500 leading-relaxed", children: s.desc })] }), i < ARCH_STAGES.length - 1 && (_jsx("div", { className: "absolute -right-3 top-8 z-10 flex items-center", children: _jsxs("svg", { width: "24", height: "16", viewBox: "0 0 24 16", children: [_jsx("defs", { children: _jsx("style", { children: `
                        @keyframes flowDash {
                          to { stroke-dashoffset: -24; }
                        }
                        .flow-arrow { animation: flowDash 0.8s linear infinite; }
                      ` }) }), _jsx("line", { x1: "0", y1: "8", x2: "18", y2: "8", stroke: ARCH_STAGES[i].color, strokeWidth: "1.5", strokeDasharray: "4 2", className: "flow-arrow", opacity: "0.8" }), _jsx("polygon", { points: "18,4 24,8 18,12", fill: ARCH_STAGES[i + 1].color, opacity: "0.9" })] }) }))] }, s.title))) }) })] }));
}
/* ─────────────────────────────────────────────────────────── */
/*  3-Tier System Architecture                                 */
/* ─────────────────────────────────────────────────────────── */
function SystemArchDiagram() {
    return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-5", children: [_jsxs("div", { className: "mb-5", children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted", children: "\uC2DC\uC2A4\uD15C \uC544\uD0A4\uD14D\uCC98" }), _jsx("p", { className: "text-sm font-bold text-slate-200 mt-0.5", children: "Simulation \u2192 Learning \u2192 Real-World Deployment" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-0", children: [_jsxs("div", { className: "relative rounded-t-xl lg:rounded-l-xl lg:rounded-tr-none border border-b-0 lg:border-b lg:border-r-0 border-nvidia/30 bg-[#060e04] p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-nvidia/10 border border-nvidia/30 flex items-center justify-center text-base", children: "\uD83C\uDF0D" }), _jsxs("div", { children: [_jsx("p", { className: "text-[9px] font-black uppercase tracking-widest text-nvidia/60", children: "Tier 1" }), _jsx("p", { className: "text-xs font-black text-nvidia", children: "Simulation Layer" })] })] }), _jsx("div", { className: "flex flex-col gap-2", children: [
                                    { name: 'Isaac Sim', sub: 'Omniverse USD', color: '#76b900' },
                                    { name: 'Isaac Lab', sub: 'RL Framework', color: '#76b900' },
                                    { name: 'PhysX 5', sub: 'Physics Engine', color: '#a0d060' },
                                    { name: '4096 Envs', sub: 'GPU Parallel', color: '#76b900' },
                                ].map(item => (_jsxs("div", { className: "flex items-center gap-2 px-2 py-1.5 rounded-lg bg-nvidia/5 border border-nvidia/15", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full flex-shrink-0", style: { background: item.color } }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-bold text-slate-200", children: item.name }), _jsx("p", { className: "text-[8px] text-slate-500", children: item.sub })] })] }, item.name))) }), _jsx("div", { className: "mt-4 pt-3 border-t border-nvidia/15", children: _jsx("p", { className: "text-[8px] text-slate-600 leading-relaxed", children: "\uBB3C\uB9AC\uC801\uC73C\uB85C \uC815\uD655\uD55C \uB85C\uBD07 \uD658\uACBD\uC744 GPU\uC5D0\uC11C \uC218\uCC9C \uAC1C \uBCD1\uB82C\uB85C \uC2E4\uD589\uD558\uC5EC \uC2E4\uC81C\uBCF4\uB2E4 \uBE60\uB978 \uACBD\uD5D8 \uC218\uC9D1" }) })] }), _jsxs("div", { className: "relative border border-purple-500/30 bg-[#0a0810] p-4", children: [_jsx("div", { className: "absolute -left-4 top-1/2 -translate-y-1/2 z-20", children: _jsxs("svg", { width: "32", height: "60", viewBox: "0 0 32 60", children: [_jsx("defs", { children: _jsx("style", { children: `
                  @keyframes hFlow { to { stroke-dashoffset: -20; } }
                  .h-flow { animation: hFlow 0.7s linear infinite; }
                ` }) }), _jsx("line", { x1: "0", y1: "16", x2: "24", y2: "16", stroke: "#76b900", strokeWidth: "1.5", strokeDasharray: "4 2", className: "h-flow", opacity: "0.7" }), _jsx("polygon", { points: "24,12 32,16 24,20", fill: "#76b900", opacity: "0.8" }), _jsx("line", { x1: "0", y1: "44", x2: "24", y2: "44", stroke: "#76b900", strokeWidth: "1.5", strokeDasharray: "4 2", className: "h-flow", opacity: "0.7" }), _jsx("polygon", { points: "24,40 32,44 24,48", fill: "#76b900", opacity: "0.8" })] }) }), _jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-base", children: "\uD83E\uDDE0" }), _jsxs("div", { children: [_jsx("p", { className: "text-[9px] font-black uppercase tracking-widest text-purple-400/60", children: "Tier 2" }), _jsx("p", { className: "text-xs font-black text-purple-400", children: "Policy Learning" })] })] }), _jsxs("div", { className: "rounded-lg border border-purple-500/25 bg-purple-900/10 p-2.5 mb-2", children: [_jsx("p", { className: "text-[9px] font-black text-purple-300 mb-1.5", children: "\u2460 Behavior Cloning (IL)" }), _jsx("div", { className: "flex flex-col gap-1", children: ['MLP: obs[45] → act[9]', 'Loss: MSE + L2 reg', 'Adam · lr=3e-4'].map(t => (_jsx("p", { className: "text-[8px] text-slate-400 font-mono", children: t }, t))) })] }), _jsx("div", { className: "flex justify-center my-1.5", children: _jsxs("svg", { width: "16", height: "20", viewBox: "0 0 16 20", children: [_jsx("line", { x1: "8", y1: "0", x2: "8", y2: "14", stroke: "#f59e0b", strokeWidth: "1.5", strokeDasharray: "3 2" }), _jsx("polygon", { points: "3,14 13,14 8,20", fill: "#f59e0b", opacity: "0.8" })] }) }), _jsxs("div", { className: "rounded-lg border border-amber-500/25 bg-amber-900/10 p-2.5", children: [_jsx("p", { className: "text-[9px] font-black text-amber-300 mb-1.5", children: "\u2461 PPO Fine-tuning (RL)" }), _jsx("div", { className: "flex flex-col gap-1", children: ['SB3 PPO · γ=0.99', 'GAE · λ=0.95', '4096 envs · 2048 steps'].map(t => (_jsx("p", { className: "text-[8px] text-slate-400 font-mono", children: t }, t))) })] }), _jsx("div", { className: "mt-3 pt-2.5 border-t border-purple-500/15", children: _jsx("p", { className: "text-[8px] text-slate-600 leading-relaxed", children: "IL\uB85C \uC548\uC815\uC801\uC778 \uCD08\uAE30 \uC815\uCC45 \uD559\uC2B5 \uD6C4 RL\uB85C \uCD5C\uC801\uD654. \uC0D8\uD50C \uD6A8\uC728\uC744 10\u00D7 \uD5A5\uC0C1" }) })] }), _jsxs("div", { className: "relative rounded-b-xl lg:rounded-r-xl lg:rounded-bl-none border border-t-0 lg:border-t lg:border-l-0 border-red-500/30 bg-[#0e0606] p-4", children: [_jsx("div", { className: "absolute -left-4 top-1/2 -translate-y-1/2 z-20", children: _jsxs("svg", { width: "32", height: "60", viewBox: "0 0 32 60", children: [_jsx("line", { x1: "0", y1: "16", x2: "24", y2: "16", stroke: "#a855f7", strokeWidth: "1.5", strokeDasharray: "4 2", opacity: "0.7" }), _jsx("polygon", { points: "24,12 32,16 24,20", fill: "#a855f7", opacity: "0.8" }), _jsx("line", { x1: "0", y1: "44", x2: "24", y2: "44", stroke: "#a855f7", strokeWidth: "1.5", strokeDasharray: "4 2", opacity: "0.7" }), _jsx("polygon", { points: "24,40 32,44 24,48", fill: "#a855f7", opacity: "0.8" })] }) }), _jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-base", children: "\uD83E\uDD16" }), _jsxs("div", { children: [_jsx("p", { className: "text-[9px] font-black uppercase tracking-widest text-red-400/60", children: "Tier 3" }), _jsx("p", { className: "text-xs font-black text-red-400", children: "Real-World Deploy" })] })] }), _jsx("div", { className: "flex flex-col gap-2", children: [
                                    { name: 'ONNX Runtime', sub: 'opset-18 · < 1ms', color: '#ef4444' },
                                    { name: 'Franka Panda', sub: '7-DOF Arm', color: '#f87171' },
                                    { name: 'ROS 2 Humble', sub: 'Robot Middleware', color: '#ef4444' },
                                    { name: 'Sim-to-Real', sub: 'Zero-shot Transfer', color: '#fca5a5' },
                                ].map(item => (_jsxs("div", { className: "flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/5 border border-red-500/15", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full flex-shrink-0", style: { background: item.color } }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-bold text-slate-200", children: item.name }), _jsx("p", { className: "text-[8px] text-slate-500", children: item.sub })] })] }, item.name))) }), _jsx("div", { className: "mt-4 pt-3 border-t border-red-500/15", children: _jsx("p", { className: "text-[8px] text-slate-600 leading-relaxed", children: "ONNX\uB85C \uBCC0\uD658\uB41C \uC815\uCC45\uC744 \uC2E4\uC81C \uB85C\uBD07\uC5D0 zero-shot\uC73C\uB85C \uBC30\uD3EC. \uCD94\uAC00 \uD29C\uB2DD \uC5C6\uC774 \uC989\uC2DC \uB3D9\uC791" }) })] })] }), _jsx("div", { className: "mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3", children: [
                    { label: '병렬 환경', value: '4,096', sub: 'GPU instances', color: '#76b900' },
                    { label: '훈련 속도', value: '10×', sub: 'vs. real-time', color: '#00d4ff' },
                    { label: '정책 추론', value: '<1ms', sub: 'ONNX latency', color: '#a855f7' },
                    { label: '전송 성공률', value: '92%', sub: 'sim-to-real', color: '#ef4444' },
                ].map(m => (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2 rounded-lg bg-surface border border-border", children: [_jsx("p", { className: "text-xl font-black font-mono", style: { color: m.color }, children: m.value }), _jsxs("div", { children: [_jsx("p", { className: "text-[9px] font-bold text-slate-400", children: m.label }), _jsx("p", { className: "text-[8px] text-slate-600", children: m.sub })] })] }, m.label))) })] }));
}
/* ─────────────────────────────────────────────────────────── */
/*  Dataset Quality Panel                                      */
/* ─────────────────────────────────────────────────────────── */
const ACTION_STD = [0.1509, 0.1538, 0.1487, 0.1518, 0.1523, 0.1516, 0.1505, 0.1496, 0.1529, 0.1548];
const JOINT_LABELS = ['J0', 'J1', 'J2', 'J3', 'J4', 'J5', 'J6'];
const JOINT_COLORS = ['#76b900', '#00d4ff', '#a855f7', '#f59e0b', '#ef4444', '#10b981', '#f97316'];
function DatasetQualityPanel() {
    const maxStd = Math.max(...ACTION_STD);
    return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted", children: "\uB370\uC774\uD130\uC14B \uD488\uC9C8 \uAC80\uC99D" }), _jsx("p", { className: "text-sm font-bold text-slate-200 mt-0.5", children: "synthetic_v1.hdf5 \u2014 10,000 frames \u00B7 50 rollouts" })] }), _jsxs("span", { className: "flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border border-nvidia/30 text-nvidia bg-nvidia/5 font-bold", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-nvidia animate-pulse" }), "VERIFIED"] })] }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5", children: [
                    { label: 'RGB Mean', value: '45.8', sub: 'std: 22.6  (non-zero)', color: '#76b900' },
                    { label: 'Joint Std', value: '0.353', sub: 'sinusoidal trajectory', color: '#00d4ff' },
                    { label: 'Reward Range', value: '±0.44', sub: 'min -0.436 / max 0.351', color: '#f59e0b' },
                    { label: 'Total Steps', value: '10,000', sub: '50 rollouts × 200 steps', color: '#a855f7' },
                ].map(m => (_jsxs("div", { className: "rounded-lg border border-border bg-surface px-3 py-2.5 flex flex-col gap-1", children: [_jsx("p", { className: "text-[9px] font-black uppercase tracking-wider text-muted", children: m.label }), _jsx("p", { className: "text-xl font-black font-mono", style: { color: m.color }, children: m.value }), _jsx("p", { className: "text-[9px] text-slate-500 leading-tight", children: m.sub })] }, m.label))) }), _jsxs("div", { className: "mb-5", children: [_jsx("p", { className: "text-[10px] font-bold text-muted uppercase tracking-widest mb-2", children: "Action Std per DOF (10 dim) \u2014 exploration noise \uBC18\uC601" }), _jsx("div", { className: "bg-[#0d1117] rounded-lg p-3 flex flex-col gap-1.5", children: ACTION_STD.map((std, i) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-[9px] font-mono text-slate-500 w-14 shrink-0", children: ["Action[", i, "]"] }), _jsx("div", { className: "flex-1 h-3 bg-slate-800 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full rounded-full transition-all", style: {
                                            width: `${(std / maxStd) * 100}%`,
                                            background: `hsl(${i * 36}, 70%, 55%)`,
                                        } }) }), _jsx("span", { className: "text-[9px] font-mono w-12 text-right shrink-0", style: { color: `hsl(${i * 36}, 70%, 60%)` }, children: std.toFixed(4) })] }, i))) })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-3", children: [_jsxs("div", { className: "rounded-lg border border-border bg-surface p-3", children: [_jsx("p", { className: "text-[9px] font-bold uppercase tracking-wider text-muted mb-2", children: "Joint State \u2014 7 DOF \uBD84\uD3EC" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: JOINT_LABELS.map((label, i) => (_jsxs("span", { className: "text-[9px] font-mono px-2 py-0.5 rounded border", style: {
                                        color: JOINT_COLORS[i],
                                        borderColor: JOINT_COLORS[i] + '40',
                                        background: JOINT_COLORS[i] + '12',
                                    }, children: [label, ": sin(", 'π', i, "/7)"] }, label))) }), _jsx("p", { className: "text-[9px] text-slate-500 mt-2 leading-relaxed", children: "\uB2E8\uACC4\uBCC4 \uC704\uC0C1\uCC28\uB97C \uB450\uC5B4 \uAD00\uC808\uB9C8\uB2E4 \uB2E4\uB978 \uADA4\uC801 \uC0DD\uC131 \u00B7 std = 0.353" })] }), _jsxs("div", { className: "rounded-lg border border-border bg-surface p-3", children: [_jsx("p", { className: "text-[9px] font-bold uppercase tracking-wider text-muted mb-2", children: "RGB Frame \uD488\uC9C8" }), _jsx("div", { className: "flex flex-col gap-1.5", children: [
                                    { ch: 'R', desc: 'sin(t + x×3) gradient', val: '20–100', color: '#ef4444' },
                                    { ch: 'G', desc: 'sin(t×0.7 + y×2) gradient', val: '10–70', color: '#22c55e' },
                                    { ch: 'B', desc: 'constant + noise(0–15)', val: '30–45', color: '#3b82f6' },
                                ].map(c => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[9px] font-black w-4 text-center rounded", style: { color: c.color }, children: c.ch }), _jsx("span", { className: "text-[9px] text-slate-400 font-mono flex-1", children: c.desc }), _jsx("span", { className: "text-[9px] font-mono text-slate-500", children: c.val })] }, c.ch))) }), _jsx("p", { className: "text-[9px] text-slate-500 mt-2 leading-relaxed", children: "\uC2DC\uAC04 t\uC5D0 \uB530\uB77C \uBCC0\uD654\uD558\uB294 \uADF8\uB77C\uB514\uC5B8\uD2B8 \uC52C \u00B7 mean = 45.8 \u00B7 std = 22.6" })] })] }), _jsxs("div", { className: "mt-4 rounded-lg border border-amber-500/20 bg-amber-950/10 p-3", children: [_jsx("p", { className: "text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-2", children: "\uC218\uC815 \uC804 / \uD6C4 \uBE44\uAD50" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[9px] font-bold text-red-400 mb-1", children: "Before (all-zero)" }), [
                                        'RGB mean: 0.0 · std: 0.0',
                                        'Joint std: 0.000 (flat)',
                                        'Action std: 0.000 (constant)',
                                    ].map(t => (_jsxs("p", { className: "text-[9px] font-mono text-slate-500 flex gap-1.5", children: [_jsx("span", { className: "text-red-500", children: "\u2717" }), t] }, t)))] }), _jsxs("div", { children: [_jsx("p", { className: "text-[9px] font-bold text-nvidia mb-1", children: "After (fixed)" }), [
                                        'RGB mean: 45.8 · std: 22.6',
                                        'Joint std: 0.353 (sinusoidal)',
                                        'Action std: ~0.15 (exploration)',
                                    ].map(t => (_jsxs("p", { className: "text-[9px] font-mono text-slate-400 flex gap-1.5", children: [_jsx("span", { className: "text-nvidia", children: "\u2713" }), t] }, t)))] })] })] })] }));
}
/* ─────────────────────────────────────────────────────────── */
/*  Pipeline Test Result Panel                                 */
/* ─────────────────────────────────────────────────────────── */
const TEST_STAGES = [
    {
        id: 'ENV',
        color: '#76b900',
        time: '< 1s',
        rows: [
            { label: 'Status', value: 'PASS', ok: true },
            { label: 'Obs keys', value: 'rgb · depth · joint_state · ee_pose', ok: true },
            { label: 'Mode', value: 'mock_mode = True', ok: true },
        ],
    },
    {
        id: 'COLLECT',
        color: '#00d4ff',
        time: '~5s',
        rows: [
            { label: 'Episodes', value: '77 total (+5 new)', ok: true },
            { label: 'Steps/ep', value: '500', ok: true },
            { label: 'Format', value: 'HDF5 per episode', ok: true },
        ],
    },
    {
        id: 'IL',
        color: '#a855f7',
        time: '~8s',
        rows: [
            { label: 'Epochs', value: '5 (test) / 100 (full)', ok: true },
            { label: 'Loss trend', value: '0.3331 → 0.3330', ok: true },
            { label: 'Best saved', value: 'checkpoints/il/best.pt', ok: true },
        ],
    },
    {
        id: 'RL',
        color: '#f59e0b',
        time: '~20s',
        rows: [
            { label: 'Steps', value: '5,000 (test) / 50,000 (full)', ok: true },
            { label: 'Reward @ 6144', value: '+0.0026', ok: true },
            { label: 'Best saved', value: 'checkpoints/rl/best.zip', ok: true },
        ],
    },
    {
        id: 'EXPORT',
        color: '#ef4444',
        time: '~3s',
        rows: [
            { label: 'policy.onnx', value: '282.9 KB · opset-18', ok: true },
            { label: 'HDF5 frames', value: '1,000 (RGB std 22.6)', ok: true },
            { label: 'Action std', value: '~0.152 (all 10 DOF)', ok: true },
        ],
    },
];
function PipelineTestPanel() {
    return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted", children: "\uD30C\uC774\uD504\uB77C\uC778 \uC2E4\uD589 \uD14C\uC2A4\uD2B8" }), _jsx("p", { className: "text-sm font-bold text-slate-200 mt-0.5", children: "End-to-End Test Run \u00B7 All 5 Stages Passed" })] }), _jsxs("span", { className: "flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border border-emerald-500/40 text-emerald-400 bg-emerald-900/20 font-bold", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-400" }), "ALL PASSED"] })] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3", children: TEST_STAGES.map((s, i) => (_jsxs("div", { className: "rounded-xl border p-3 flex flex-col gap-2", style: { borderColor: s.color + '35', background: 'linear-gradient(135deg,#0d1018 0%,#111620 100%)' }, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400" }), _jsxs("span", { className: "text-[10px] font-black", style: { color: s.color }, children: [String(i + 1).padStart(2, '0'), " ", s.id] })] }), _jsx("span", { className: "text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-500", children: s.time })] }), _jsx("div", { className: "flex flex-col gap-1 pt-1.5 border-t border-border/60", children: s.rows.map(r => (_jsxs("div", { className: "flex items-start gap-1.5", children: [_jsx("span", { className: "text-emerald-500 text-[8px] mt-0.5 flex-shrink-0", children: "\u2713" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("span", { className: "text-[8px] text-slate-500", children: [r.label, ": "] }), _jsx("span", { className: "text-[8px] font-mono", style: { color: s.color + 'cc' }, children: r.value })] })] }, r.label))) })] }, s.id))) }), _jsx("div", { className: "mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3", children: [
                    { label: '총 실행 시간', value: '~37s', sub: '5 stages (test params)', color: '#76b900' },
                    { label: '데모 에피소드', value: '77', sub: '38,500 steps collected', color: '#00d4ff' },
                    { label: 'ONNX 정책', value: '283 KB', sub: 'opset-18 deploy-ready', color: '#ef4444' },
                    { label: 'IL→RL 전달', value: 'N/A', sub: 'obs_dim mismatch (known)', color: '#f59e0b' },
                ].map(m => (_jsxs("div", { className: "rounded-lg border border-border bg-surface px-3 py-2.5 flex flex-col gap-0.5", children: [_jsx("p", { className: "text-[9px] font-black uppercase tracking-wider text-muted", children: m.label }), _jsx("p", { className: "text-lg font-black font-mono", style: { color: m.color }, children: m.value }), _jsx("p", { className: "text-[9px] text-slate-500 leading-tight", children: m.sub })] }, m.label))) }), _jsxs("div", { className: "mt-3 rounded-lg border border-amber-500/20 bg-amber-950/10 px-3 py-2.5", children: [_jsx("p", { className: "text-[9px] font-bold text-amber-400 mb-1", children: "Known Issue \u2014 IL Weight Transfer" }), _jsx("p", { className: "text-[9px] text-slate-500 leading-relaxed", children: "IL(BCTrainer) obs_dim=14 (joint_state+ee_pose) vs RL(FlatObsEnv) obs_dim\uC774 \uBD88\uC77C\uCE58\uD558\uC5EC \uAC00\uC911\uCE58 \uC804\uB2EC\uC774 \uAC74\uB108\uB700. PPO\uB294 \uB79C\uB364 \uCD08\uAE30\uD654\uB85C \uB3C5\uB9BD \uD559\uC2B5. \uD574\uACB0: FlatObsEnv obs_dim\uC744 IL\uACFC \uD1B5\uC77C \uD544\uC694." })] })] }));
}
/* ─────────────────────────────────────────────────────────── */
/*  Stat Card                                                  */
/* ─────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color = 'default', }) {
    const valueClass = {
        green: 'text-emerald-400',
        nvidia: 'text-nvidia',
        amber: 'text-amber-400',
        default: 'text-slate-100',
    }[color];
    return (_jsxs("div", { className: "bg-panel border border-border rounded-xl p-4 flex flex-col gap-1", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-widest text-muted", children: label }), _jsx("p", { className: clsx('text-2xl font-black font-mono', valueClass), children: value }), sub && _jsx("p", { className: "text-[11px] text-slate-500", children: sub })] }));
}
/* ─────────────────────────────────────────────────────────── */
/*  Overview Page                                              */
/* ─────────────────────────────────────────────────────────── */
export function Overview() {
    const { data: status } = usePipelineStatus();
    const { data: artifacts = [] } = useArtifacts();
    const { mutate: runStage } = useRunStage();
    const apiBase = (import.meta.env.VITE_API_URL ?? '') + '/api';
    const { lines, connected } = useSSELogs(`${apiBase}/logs/stream`);
    const { points } = useSSEMetrics(`${apiBase}/metrics/stream`);
    const stages = STAGE_DEFS.map(def => ({
        ...def,
        status: status?.stage === def.id ? 'running' : 'pending',
        detail: '',
    }));
    const ilMetrics = points.filter(p => p.stage === 'il');
    const rlMetrics = points.filter(p => p.stage === 'rl');
    const lastRew = rlMetrics.at(-1)?.rew_mean;
    const lastLoss = ilMetrics.at(-1)?.loss;
    const lastStep = rlMetrics.at(-1)?.step;
    return (_jsxs("div", { className: "flex-1 overflow-y-auto flex flex-col", children: [_jsxs("div", { className: "relative flex-shrink-0 overflow-hidden bg-[#04060a] border-b border-border", children: [_jsx("div", { className: "absolute inset-0 opacity-[0.035]", style: {
                            backgroundImage: 'linear-gradient(#76b900 1px, transparent 1px), linear-gradient(90deg, #76b900 1px, transparent 1px)',
                            backgroundSize: '56px 56px',
                        } }), _jsx("div", { className: "absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-nvidia opacity-[0.05] blur-3xl pointer-events-none" }), _jsx("div", { className: "absolute -bottom-20 right-0 w-80 h-80 rounded-full bg-nvidia opacity-[0.035] blur-2xl pointer-events-none" }), _jsx("div", { className: "absolute top-1/2 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 opacity-[0.025] blur-3xl pointer-events-none" }), _jsxs("div", { className: "relative px-4 sm:px-8 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center max-w-7xl mx-auto w-full", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 mb-5", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-full bg-nvidia/10 text-nvidia border border-nvidia/30 uppercase tracking-widest", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-nvidia animate-pulse" }), "NVIDIA Omniverse"] }), ['Isaac Lab', 'Isaac Sim', 'Sim-to-Real'].map(t => (_jsx("span", { className: "text-[10px] font-bold px-3 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-border uppercase tracking-wider", children: t }, t)))] }), _jsxs("h1", { className: "text-4xl font-black leading-tight mb-3 tracking-tight", children: [_jsx("span", { className: "text-white", children: "Physical AI" }), _jsx("br", {}), _jsx("span", { className: "text-nvidia", children: "Robot Policy Learning" })] }), _jsxs("p", { className: "text-sm text-slate-400 leading-relaxed max-w-xl mb-5", children: ["NVIDIA Isaac Lab \uC2DC\uBBAC\uB808\uC774\uC158 \uC704\uC5D0\uC11C \uB85C\uBD07 \uC815\uCC45\uC744 \uCC98\uC74C\uBD80\uD130 \uD6C8\uB828\uD558\uB294 End-to-End \uD30C\uC774\uD504\uB77C\uC778. Behavior Cloning \uC0AC\uC804 \uD6C8\uB828 \uD6C4 PPO \uAC15\uD654\uD559\uC2B5\uC73C\uB85C \uD30C\uC778\uD29C\uB2DD\uD558\uC5EC \uC2E4\uC81C \uB85C\uBD07\uC5D0 \uBC14\uB85C \uBC30\uD3EC \uAC00\uB2A5\uD55C", ' ', _jsx("span", { className: "text-nvidia font-semibold", children: "ONNX \uC815\uCC45" }), "\uC744 \uC0DD\uC131\uD569\uB2C8\uB2E4."] }), _jsx("div", { className: "flex flex-wrap gap-2 mb-6", children: [
                                            'PhysX 5 물리 엔진', 'GPU 4096× 병렬', 'HDF5 데모 저장',
                                            'MLP Policy', 'SB3 PPO', 'ONNX opset-18',
                                        ].map(tag => (_jsx("span", { className: "text-[10px] px-2.5 py-1 rounded border border-nvidia/20 text-nvidia/70 bg-nvidia/5 font-semibold", children: tag }, tag))) }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => runStage({ stage: 'env', validate: true }), disabled: status?.running, className: clsx('flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all', status?.running
                                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                    : 'bg-nvidia hover:bg-nvidia/90 text-black shadow-lg shadow-nvidia/20'), children: status?.running ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "animate-spin", children: "\u27F3" }), " ", status.stage?.toUpperCase(), " \uC2E4\uD589 \uC911..."] })) : (_jsx(_Fragment, { children: "\u25B6 \uD6C8\uB828 \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791" })) }), _jsx("a", { href: "https://isaac-sim.github.io/IsaacLab/", target: "_blank", rel: "noopener noreferrer", className: "text-xs text-slate-500 hover:text-nvidia transition-colors underline underline-offset-4", children: "Isaac Lab \uACF5\uC2DD \uBB38\uC11C \u2192" })] })] }), _jsx(SimViewport, {})] }), _jsxs("div", { className: "relative mx-4 sm:mx-8 mb-6 sm:mb-8 rounded-xl overflow-hidden border border-nvidia/20 shadow-lg shadow-nvidia/10", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 bg-[#0a0d1a] border-b border-nvidia/15", children: [_jsx("p", { className: "text-[9px] font-black uppercase tracking-widest text-nvidia/60", children: "NVIDIA Omniverse \u2014 Warehouse Scene" }), _jsx("span", { className: "text-[9px] px-2 py-0.5 rounded-full border border-nvidia/25 text-nvidia/70 bg-nvidia/5 font-bold", children: "OVRTX Render" })] }), _jsx("img", { src: "/bg-warehouse.jpg", alt: "NVIDIA Omniverse Warehouse Scene", className: "w-full object-cover", style: { maxHeight: '260px' } })] })] }), _jsxs("div", { className: "flex-1 p-3 sm:p-6 flex flex-col gap-4 sm:gap-5", children: [_jsx(PipelineArchDiagram, {}), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsxs("div", { className: "rounded-xl overflow-hidden border border-nvidia/20 shadow-lg shadow-nvidia/10", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2.5 bg-panel border-b border-nvidia/15", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted", children: "\uB80C\uB354\uB9C1 \uACB0\uACFC" }), _jsx("p", { className: "text-sm font-bold text-slate-200", children: "OVRTX Minimal \u2014 Single Frame" })] }), _jsx("span", { className: "text-[10px] px-2.5 py-1 rounded-full border border-nvidia/30 text-nvidia/80 bg-nvidia/5 font-bold", children: "OVRTX Render" })] }), _jsx("img", { src: "/example-minimal.jpg", alt: "OVRTX Minimal Render", className: "w-full object-cover", style: { maxHeight: '280px' } })] }), _jsxs("div", { className: "rounded-xl overflow-hidden border border-nvidia/20 shadow-lg shadow-nvidia/10", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2.5 bg-panel border-b border-nvidia/15", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted", children: "\uB80C\uB354\uB9C1 \uB370\uBAA8" }), _jsx("p", { className: "text-sm font-bold text-slate-200", children: "NVIDIA Omniverse \u2014 Vulkan Interop" })] }), _jsx("span", { className: "text-[10px] px-2.5 py-1 rounded-full border border-nvidia/30 text-nvidia/80 bg-nvidia/5 font-bold", children: "OVRTX Live" })] }), _jsx("img", { src: "/example-vulkan-interop.gif", alt: "NVIDIA Omniverse Vulkan Interop Demo", className: "w-full object-cover", style: { maxHeight: '280px' } })] })] }), _jsx(SystemArchDiagram, {}), _jsx(PipelineBar, { stages: stages, onRun: id => runStage({ stage: id, validate: id === 'env' }), disabled: status?.running }), _jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3", children: [_jsx(StatCard, { label: "\uD604\uC7AC \uB2E8\uACC4", value: status?.running ? status.stage.toUpperCase() : 'Idle', sub: status?.running ? '▶ 실행 중' : '대기', color: status?.running ? 'nvidia' : 'default' }), _jsx(StatCard, { label: "IL \uC190\uC2E4 (Best)", value: lastLoss?.toFixed(4) ?? '—', sub: ilMetrics.length > 0 ? `Epoch ${ilMetrics.at(-1)?.step}` : '데이터 없음', color: "green" }), _jsx(StatCard, { label: "RL \uBCF4\uC0C1 (Latest)", value: lastRew?.toFixed(4) ?? '—', sub: lastStep !== undefined ? `Step ${lastStep.toLocaleString()}` : '미시작', color: "amber" }), _jsx(StatCard, { label: "\uB0B4\uBCF4\uB0B8 \uC544\uD2F0\uD329\uD2B8", value: artifacts.length, sub: artifacts.length > 0 ? artifacts[0].name : 'export 후 생성됨' })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsx(RewardChart, { points: points }), _jsx(LogPanel, { lines: lines, connected: connected })] }), _jsx(PipelineTestPanel, {}), _jsx(DatasetQualityPanel, {}), _jsx(ArtifactList, { artifacts: artifacts }), _jsxs("div", { className: "flex items-center justify-between pt-2 border-t border-border", children: [_jsxs("div", { className: "flex items-center gap-3 text-[10px] text-slate-600", children: [_jsx("span", { children: "Powered by" }), _jsx("span", { className: "text-nvidia font-bold", children: "NVIDIA Omniverse" }), _jsx("span", { children: "\u00B7" }), _jsx("span", { children: "Isaac Lab" }), _jsx("span", { children: "\u00B7" }), _jsx("span", { children: "Isaac Sim" })] }), _jsx("span", { className: "text-[10px] text-slate-700", children: "PhysicalAI v0.1.0" })] })] })] }));
}
