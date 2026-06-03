import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { api } from '../api/client'
import type { ConfigMap } from '../api/client'
import { getApiRoot, getApiOverride, setApiOverride, reloadWithLanding } from '../api/base'

function renderValue(val: unknown, depth = 0): React.ReactNode {
  if (val === null || val === undefined) return <span className="text-slate-600">null</span>
  if (typeof val === 'boolean') return <span className="text-amber-400">{String(val)}</span>
  if (typeof val === 'number') return <span className="text-sky-400">{val}</span>
  if (typeof val === 'string') return <span className="text-emerald-400">"{val}"</span>
  if (Array.isArray(val)) {
    return (
      <span className="text-slate-300">
        [<span className="text-violet-300">{val.join(', ')}</span>]
      </span>
    )
  }
  if (typeof val === 'object') {
    return (
      <div className={depth > 0 ? 'ml-4' : ''}>
        {Object.entries(val as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="flex gap-2 items-start">
            <span className="text-indigo-300 flex-shrink-0">{k}:</span>
            <span>{renderValue(v, depth + 1)}</span>
          </div>
        ))}
      </div>
    )
  }
  return <span className="text-slate-300">{String(val)}</span>
}

const CONFIG_META: Record<string, { icon: string; label: string; desc: string }> = {
  env:      { icon: '🌍', label: 'Environment',  desc: 'Isaac 환경, 로봇, 센서 설정' },
  rl:       { icon: '🤖', label: 'RL Training',  desc: 'PPO/SAC 하이퍼파라미터' },
  il:       { icon: '📚', label: 'IL Training',  desc: 'Behavioral Cloning 설정' },
  collector:{ icon: '🎬', label: 'Collector',    desc: '데모 수집 파라미터' },
  export:   { icon: '📤', label: 'Export',       desc: 'ONNX 및 데이터셋 내보내기 설정' },
}

export function Config() {
  const { data: config = {} as ConfigMap, isLoading, isError } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    staleTime: 30_000,
  })

  const [backendInput, setBackendInput] = useState<string>(getApiOverride() ?? '')
  const activeRoot = getApiRoot()
  const applyBackend = () => {
    setApiOverride(backendInput)
    reloadWithLanding('Config')  // re-resolve API base + reconnect SSE, staying on Config
  }

  const keys = Object.keys(config)
  const [active, setActive] = useState<string>('')
  const selectedKey = active || keys[0] || ''
  const selectedCfg = config[selectedKey]

  return (
    <div className="flex-1 overflow-hidden p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-bold text-slate-200">Configuration</h2>
        <p className="text-xs text-muted mt-0.5">configs/ 디렉터리의 YAML 파일을 읽기 전용으로 표시합니다</p>
      </div>

      {/* Backend override — point the dashboard at an ad-hoc backend (e.g. a
          Colab GPU exposed via cloudflared) without rebuilding. */}
      <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-200">Backend (API)</p>
          <span className="text-[10px] font-mono text-muted truncate max-w-[60%]" title={activeRoot || '(same origin)'}>
            현재: {activeRoot || '(기본/동일 출처)'}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            value={backendInput}
            onChange={e => setBackendInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyBackend() }}
            placeholder="https://<tunnel>.trycloudflare.com  (비우면 기본값)"
            className="flex-1 bg-[#0d1117] border border-border rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={applyBackend}
            className="text-xs font-bold px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors whitespace-nowrap"
          >적용 (새로고침)</button>
          <button
            onClick={() => { setApiOverride(''); reloadWithLanding('Config') }}
            className="text-xs font-bold px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
          >초기화</button>
        </div>
        <p className="text-[10px] text-muted">
          Colab GPU 백엔드의 cloudflared URL을 붙여넣으면 Run/Training이 그 GPU에서 실행됩니다. <code className="text-slate-400">?api=&lt;url&gt;</code> 쿼리로도 설정 가능.
        </p>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">로딩 중...</div>
      ) : isError ? (
        <div className="flex-1 flex items-center justify-center text-red-400 text-sm">설정 파일을 불러올 수 없습니다</div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* 탭 목록 */}
          <div className="w-44 flex-shrink-0 flex flex-col gap-1">
            {keys.map(k => {
              const meta = CONFIG_META[k]
              return (
                <button
                  key={k}
                  onClick={() => setActive(k)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors',
                    selectedKey === k ? 'bg-indigo-950 text-indigo-300' : 'text-slate-400 hover:bg-border hover:text-slate-200'
                  )}
                >
                  <span>{meta?.icon ?? '⚙'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{meta?.label ?? k}</p>
                    <p className="text-[10px] text-muted truncate">{k}.yaml</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* 설정 내용 */}
          <div className="flex-1 bg-panel border border-border rounded-xl p-4 overflow-y-auto min-h-0">
            {selectedKey ? (
              <>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                  <span className="text-xl">{CONFIG_META[selectedKey]?.icon ?? '⚙'}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-200">{CONFIG_META[selectedKey]?.label ?? selectedKey}</p>
                    <p className="text-[10px] text-muted">{CONFIG_META[selectedKey]?.desc}</p>
                  </div>
                  <span className="ml-auto text-[10px] text-slate-600 font-mono">configs/{selectedKey}.yaml</span>
                </div>
                <div className="font-mono text-xs leading-relaxed">
                  {renderValue(selectedCfg)}
                </div>
              </>
            ) : (
              <p className="text-slate-600 text-xs">설정 파일이 없습니다</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
