import { useEffect, useRef, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { clsx } from 'clsx'
import { useSystem, useColabLatest } from '../hooks/usePipeline'
import { getApiRoot, getApiOverride, setApiOverride } from '../api/base'
import type { GpuStat } from '../api/client'

export type ResourceKind = 'gpu' | 'colab'

const NV = '#76b900'
const STAGES = ['env', 'collect', 'il', 'rl', 'export'] as const

interface Sample { t: string; util: number; mem: number }

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

function StatCard({ label, value, sub, bar, barColor }: {
  label: string; value: string; sub?: string; bar?: number; barColor?: string
}) {
  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-2">
      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-slate-100 leading-none">{value}</p>
      {bar !== undefined && <Bar pct={bar} color={barColor ?? NV} />}
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  )
}

/** Horizontal pipeline flow diagram with the active stage highlighted. */
function PipelineDiagram({ stage, running }: { stage: string | null; running: boolean }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STAGES.map((s, i) => {
        const active = running && stage === s
        return (
          <div key={s} className="flex items-center gap-1">
            <div className={clsx(
              'px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-colors',
              active
                ? 'bg-nvidia/15 border-nvidia/50 text-nvidia'
                : 'bg-surface border-border text-slate-500',
            )}>
              <span className="flex items-center gap-1.5">
                {active && <span className="w-1.5 h-1.5 rounded-full bg-nvidia animate-pulse" />}
                {s}
              </span>
            </div>
            {i < STAGES.length - 1 && <span className="text-slate-600 text-xs">→</span>}
          </div>
        )
      })}
    </div>
  )
}

export function Resources({ resource, onSelectResource }: {
  resource: ResourceKind
  onSelectResource: (r: ResourceKind) => void
}) {
  const q = useSystem()
  const sys = q.data
  const override = getApiOverride()
  const usingColab = !!override
  const activeRoot = getApiRoot() || '(기본/동일 출처)'

  const [colabUrl, setColabUrl] = useState(override ?? '')
  const [series, setSeries] = useState<Sample[]>([])
  const lastUpdate = useRef(0)

  // Auto-discover the Colab backend the notebook self-registers, and (optionally)
  // connect to it automatically — no copy-paste of the ngrok URL.
  const [autoConnect, setAutoConnect] = useState(true)
  const { data: latest } = useColabLatest(resource === 'colab')
  const detected = latest?.url && latest.url !== override ? latest.url : null
  useEffect(() => {
    if (resource === 'colab' && autoConnect && detected) {
      setApiOverride(detected)
      window.location.reload()
    }
  }, [resource, autoConnect, detected])

  // Sample GPU telemetry on every successful poll for the live graph.
  useEffect(() => {
    if (!q.dataUpdatedAt || q.dataUpdatedAt === lastUpdate.current) return
    lastUpdate.current = q.dataUpdatedAt
    const g = sys?.gpu?.gpus?.[0]
    if (!g) return
    const memPct = g.mem_total ? ((g.mem_used ?? 0) / g.mem_total) * 100 : 0
    setSeries(prev => {
      const next = [...prev, { t: new Date().toLocaleTimeString(), util: g.util ?? 0, mem: +memPct.toFixed(1) }]
      return next.length > 60 ? next.slice(next.length - 60) : next
    })
  }, [q.dataUpdatedAt, sys])

  const connectColab = () => { setApiOverride(colabUrl); window.location.reload() }
  const useDefault = () => { setApiOverride(''); window.location.reload() }

  const gpu: GpuStat | undefined = sys?.gpu?.available ? sys?.gpu?.gpus?.[0] : undefined
  const online = q.isSuccess
  const memPct = gpu?.mem_total ? ((gpu.mem_used ?? 0) / gpu.mem_total) * 100 : 0
  const pwrPct = gpu?.power_max ? ((gpu.power ?? 0) / gpu.power_max) * 100 : 0

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* 자원 선택 */}
      <div className="bg-panel border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-slate-200">Resources</p>
            <p className="text-xs text-muted">연산 자원을 선택해 연결하고 현황을 모니터링합니다</p>
          </div>
          <span className="text-[10px] font-mono text-muted truncate max-w-[45%]" title={activeRoot}>
            활성 백엔드: {activeRoot}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'gpu', icon: '🖥', title: 'GPU', desc: '로컬 / 기본(Railway) 백엔드 자원' },
            { key: 'colab', icon: '⚡', title: 'COLAB GPU', desc: 'ngrok 터널로 연결된 Colab GPU' },
          ] as const).map(opt => {
            const sel = resource === opt.key
            const isActive = (opt.key === 'colab' && usingColab) || (opt.key === 'gpu' && !usingColab)
            return (
              <button
                key={opt.key}
                onClick={() => onSelectResource(opt.key)}
                className={clsx(
                  'text-left rounded-lg border p-3 transition-colors',
                  sel ? 'bg-nvidia/10 border-nvidia/40' : 'bg-surface border-border hover:border-slate-600',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{opt.icon}</span>
                  <p className={clsx('text-sm font-bold', sel ? 'text-nvidia' : 'text-slate-200')}>{opt.title}</p>
                  {isActive && <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-300">연결됨</span>}
                </div>
                <p className="text-[10px] text-muted mt-1">{opt.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* 연결 패널 — 선택한 자원에 맞춰 항상 표시 */}
      {resource === 'colab' ? (
        <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-200">Colab GPU 백엔드 연결</p>
            {usingColab && (
              <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded',
                online ? 'bg-emerald-900 text-emerald-300' : 'bg-red-950 text-red-300')}>
                {online ? '연결됨' : '오프라인'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted">
            Colab에서 <code className="text-slate-300">colab_gpu_backend.ipynb</code>를 <b>Run all</b>로 실행하면,
            노트북이 ngrok URL을 자동 등록하고 아래 <b>자동 연결</b>이 켜져 있으면 대시보드가 알아서 붙습니다 (복붙 불필요).
            {usingColab && !online && ' (현재 백엔드 접속 불가 — 터널이 만료됐으면 노트북을 다시 실행하세요.)'}
          </p>
          <label className="flex items-center gap-2 text-[11px] text-slate-300 select-none">
            <input type="checkbox" checked={autoConnect} onChange={e => setAutoConnect(e.target.checked)} className="accent-indigo-500" />
            새 Colab URL 자동 감지·연결
          </label>
          {detected && (
            <div className="flex items-center gap-2 text-[11px] bg-emerald-950/50 border border-emerald-800 rounded-md px-3 py-2">
              <span className="text-emerald-300 font-bold">새 백엔드 감지</span>
              <span className="font-mono text-emerald-200/90 truncate flex-1">{detected}</span>
              <button onClick={() => { setApiOverride(detected); window.location.reload() }}
                      className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white whitespace-nowrap">지금 연결</button>
            </div>
          )}
          <p className="text-[10px] text-muted">또는 수동 입력:</p>
          <div className="flex gap-2">
            <input
              value={colabUrl}
              onChange={e => setColabUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') connectColab() }}
              placeholder="https://xxxx.ngrok-free.dev"
              className="flex-1 bg-[#0d1117] border border-border rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <button onClick={connectColab} className="text-xs font-bold px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white whitespace-nowrap">연결 (새로고침)</button>
            {usingColab && (
              <button onClick={useDefault} className="text-xs font-bold px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap">해제</button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-200">기본(로컬 / Railway) 백엔드</p>
            {!usingColab && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-300">사용 중</span>
            )}
          </div>
          <p className="text-[11px] text-muted font-mono break-all">활성: {activeRoot}</p>
          {usingColab && (
            <button onClick={useDefault} className="self-start text-xs font-bold px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white">기본 백엔드로 전환 (override 해제)</button>
          )}
        </div>
      )}

      {/* 현황 */}
      <div className="bg-panel border border-border rounded-xl p-4 flex items-center gap-4">
        <span className={clsx('w-3 h-3 rounded-full flex-shrink-0', online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-200">
            {online ? (gpu ? `${gpu.name}` : 'GPU 없음 — CPU 모드') : '백엔드 연결 안 됨'}
          </p>
          <p className="text-xs text-muted">
            {online
              ? (gpu
                  ? `CUDA GPU · ${sys?.host.platform} · ${sys?.mode.mock ? 'MOCK' : 'REAL'} 모드`
                  : `${sys?.host.platform} · CPU ${sys?.host.cpu_count ?? '?'}코어 · 이 백엔드엔 NVIDIA GPU가 없습니다`)
              : '활성 백엔드에 접속할 수 없습니다'}
          </p>
        </div>
        {sys?.pipeline.running && (
          <span className="ml-auto text-xs font-bold px-3 py-1 rounded-full bg-emerald-900 text-emerald-300 animate-pulse">
            {sys.pipeline.stage?.toUpperCase()} RUNNING
          </span>
        )}
      </div>

      {/* GPU 텔레메트리 카드 */}
      {gpu ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="GPU 사용률" value={`${gpu.util ?? 0}%`} bar={gpu.util ?? 0} barColor={NV} sub="utilization" />
            <StatCard label="VRAM" value={`${(((gpu.mem_used ?? 0)) / 1024).toFixed(1)} GB`} bar={memPct}
                      barColor="#6366f1" sub={`/ ${((gpu.mem_total ?? 0) / 1024).toFixed(1)} GB (${memPct.toFixed(0)}%)`} />
            <StatCard label="온도" value={`${gpu.temp ?? '—'}°C`} bar={gpu.temp ? (gpu.temp / 100) * 100 : 0}
                      barColor={(gpu.temp ?? 0) > 80 ? '#ef4444' : '#f59e0b'} sub="temperature" />
            <StatCard label="전력" value={gpu.power != null ? `${gpu.power.toFixed(0)} W` : '—'} bar={pwrPct}
                      barColor="#38bdf8" sub={gpu.power_max != null ? `/ ${gpu.power_max.toFixed(0)} W` : 'power draw'} />
          </div>

          {/* 사용률/메모리 추이 그래프 */}
          <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-muted uppercase tracking-widest">GPU 사용률 · 메모리 추이</p>
            <div className="h-56">
              {series.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">샘플 수집 중…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 4, right: 16, bottom: 0, left: -12 }}>
                    <defs>
                      <linearGradient id="gUtil" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NV} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={NV} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
                    <XAxis dataKey="t" stroke="#475569" tick={{ fontSize: 9 }} minTickGap={40} />
                    <YAxis stroke="#475569" tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                    <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3148', fontSize: 11 }} labelStyle={{ color: '#94a3b8' }} />
                    <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                    <Area type="monotone" dataKey="util" name="사용률 %" stroke={NV} fill="url(#gUtil)" strokeWidth={2} isAnimationActive={false} />
                    <Area type="monotone" dataKey="mem" name="메모리 %" stroke="#6366f1" fill="url(#gMem)" strokeWidth={2} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      ) : online && (
        <div className="bg-panel border border-border rounded-xl p-6 text-center">
          <p className="text-sm font-bold text-slate-300">이 백엔드에는 NVIDIA GPU가 없습니다</p>
          <p className="text-xs text-muted mt-1">
            {sys?.host.platform} · CPU {sys?.host.cpu_count ?? '?'}코어 — GPU 학습을 보려면 <span className="text-nvidia font-semibold">COLAB GPU</span>를 선택해 연결하세요.
          </p>
        </div>
      )}

      {/* 파이프라인 진행 다이어그램 */}
      <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted uppercase tracking-widest">파이프라인 진행</p>
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded',
            sys?.pipeline.running ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-500')}>
            {sys?.pipeline.running ? `${sys.pipeline.stage?.toUpperCase()} 실행 중` : 'IDLE'}
          </span>
        </div>
        <PipelineDiagram stage={sys?.pipeline.stage ?? null} running={!!sys?.pipeline.running} />
        <p className="text-[10px] text-muted">
          이 자원에서 실행되는 ENV → COLLECT → IL → RL → EXPORT 단계. 실행 제어는 <span className="text-slate-300">Run</span> 메뉴에서.
        </p>
      </div>
    </div>
  )
}
