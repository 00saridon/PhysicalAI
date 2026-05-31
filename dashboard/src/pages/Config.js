import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { api } from '../api/client';
function renderValue(val, depth = 0) {
    if (val === null || val === undefined)
        return _jsx("span", { className: "text-slate-600", children: "null" });
    if (typeof val === 'boolean')
        return _jsx("span", { className: "text-amber-400", children: String(val) });
    if (typeof val === 'number')
        return _jsx("span", { className: "text-sky-400", children: val });
    if (typeof val === 'string')
        return _jsxs("span", { className: "text-emerald-400", children: ["\"", val, "\""] });
    if (Array.isArray(val)) {
        return (_jsxs("span", { className: "text-slate-300", children: ["[", _jsx("span", { className: "text-violet-300", children: val.join(', ') }), "]"] }));
    }
    if (typeof val === 'object') {
        return (_jsx("div", { className: depth > 0 ? 'ml-4' : '', children: Object.entries(val).map(([k, v]) => (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsxs("span", { className: "text-indigo-300 flex-shrink-0", children: [k, ":"] }), _jsx("span", { children: renderValue(v, depth + 1) })] }, k))) }));
    }
    return _jsx("span", { className: "text-slate-300", children: String(val) });
}
const CONFIG_META = {
    env: { icon: '🌍', label: 'Environment', desc: 'Isaac 환경, 로봇, 센서 설정' },
    rl: { icon: '🤖', label: 'RL Training', desc: 'PPO/SAC 하이퍼파라미터' },
    il: { icon: '📚', label: 'IL Training', desc: 'Behavioral Cloning 설정' },
    collector: { icon: '🎬', label: 'Collector', desc: '데모 수집 파라미터' },
    export: { icon: '📤', label: 'Export', desc: 'ONNX 및 데이터셋 내보내기 설정' },
};
export function Config() {
    const { data: config = {}, isLoading, isError } = useQuery({
        queryKey: ['config'],
        queryFn: api.getConfig,
        staleTime: 30_000,
    });
    const keys = Object.keys(config);
    const [active, setActive] = useState('');
    const selectedKey = active || keys[0] || '';
    const selectedCfg = config[selectedKey];
    return (_jsxs("div", { className: "flex-1 overflow-hidden p-5 flex flex-col gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-bold text-slate-200", children: "Configuration" }), _jsx("p", { className: "text-xs text-muted mt-0.5", children: "configs/ \uB514\uB809\uD130\uB9AC\uC758 YAML \uD30C\uC77C\uC744 \uC77D\uAE30 \uC804\uC6A9\uC73C\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4" })] }), isLoading ? (_jsx("div", { className: "flex-1 flex items-center justify-center text-slate-600 text-sm", children: "\uB85C\uB529 \uC911..." })) : isError ? (_jsx("div", { className: "flex-1 flex items-center justify-center text-red-400 text-sm", children: "\uC124\uC815 \uD30C\uC77C\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" })) : (_jsxs("div", { className: "flex gap-4 flex-1 min-h-0", children: [_jsx("div", { className: "w-44 flex-shrink-0 flex flex-col gap-1", children: keys.map(k => {
                            const meta = CONFIG_META[k];
                            return (_jsxs("button", { onClick: () => setActive(k), className: clsx('flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors', selectedKey === k ? 'bg-indigo-950 text-indigo-300' : 'text-slate-400 hover:bg-border hover:text-slate-200'), children: [_jsx("span", { children: meta?.icon ?? '⚙' }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-semibold truncate", children: meta?.label ?? k }), _jsxs("p", { className: "text-[10px] text-muted truncate", children: [k, ".yaml"] })] })] }, k));
                        }) }), _jsx("div", { className: "flex-1 bg-panel border border-border rounded-xl p-4 overflow-y-auto min-h-0", children: selectedKey ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2 mb-4 pb-3 border-b border-border", children: [_jsx("span", { className: "text-xl", children: CONFIG_META[selectedKey]?.icon ?? '⚙' }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold text-slate-200", children: CONFIG_META[selectedKey]?.label ?? selectedKey }), _jsx("p", { className: "text-[10px] text-muted", children: CONFIG_META[selectedKey]?.desc })] }), _jsxs("span", { className: "ml-auto text-[10px] text-slate-600 font-mono", children: ["configs/", selectedKey, ".yaml"] })] }), _jsx("div", { className: "font-mono text-xs leading-relaxed", children: renderValue(selectedCfg) })] })) : (_jsx("p", { className: "text-slate-600 text-xs", children: "\uC124\uC815 \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" })) })] }))] }));
}
