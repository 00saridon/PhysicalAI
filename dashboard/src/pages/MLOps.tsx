import { useMemo, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import {
  useExperiments, useUsage, useSubmitExperiment, useRegisterModel, useSetPlan,
  useLeaderboard, useDeleteExperiment,
} from '../hooks/usePipeline'
import type { Experiment, CurvePoint } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AuthModal } from '../components/auth/AuthModal'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

/** Pull the backend's `detail` message out of a thrown _fetch Error. */
function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  const i = m.indexOf('{')
  if (i >= 0) {
    try { return JSON.parse(m.slice(i)).detail ?? m } catch { /* not JSON */ }
  }
  return m
}

const ALGOS = ['BC', 'PPO', 'SAC'] as const
const ROBOTS: { key: string; name: string; dataset: string }[] = [
  { key: 'franka', name: 'Franka 7-DOF Arm', dataset: 'synthetic_v1' },
  { key: 'anymal', name: 'ANYmal-D', dataset: 'anymal_v1' },
  { key: 'spot', name: 'Boston Dynamics Spot', dataset: 'spot_v1' },
  { key: 'h1', name: 'Unitree H1', dataset: 'h1_v1' },
  { key: 'g1', name: 'Unitree G1', dataset: 'g1_v1' },
  { key: 'crazyflie', name: 'Crazyflie Quadcopter', dataset: 'crazyflie_v1' },
]
const ALGO_COLOR: Record<string, string> = {
  BC: 'text-sky-300 bg-sky-950', PPO: 'text-amber-300 bg-amber-950', SAC: 'text-fuchsia-300 bg-fuchsia-950',
}

/** Tiny inline SVG sparkline of the success-rate learning curve. */
function Sparkline({ curve }: { curve: CurvePoint[] }) {
  if (!curve.length) return <span className="text-slate-600 text-[10px]">—</span>
  const w = 80, h = 22
  const xs = curve.map((_, i) => (i / Math.max(1, curve.length - 1)) * w)
  const pts = curve.map((c, i) => `${xs[i].toFixed(1)},${(h - c.success_rate * h).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#34d399" strokeWidth="1.5" />
    </svg>
  )
}

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}

export function MLOps() {
  const { user } = useAuth()
  const { data: experiments = [], isLoading } = useExperiments()
  const { data: usage } = useUsage()
  const { mutate: submit, isPending: submitting } = useSubmitExperiment()
  const { mutate: register, isPending: registering } = useRegisterModel()
  const { mutate: setPlan } = useSetPlan()
  const { mutate: deleteExp } = useDeleteExperiment()

  const [algo, setAlgo] = useState<string>('PPO')
  const [robot, setRobot] = useState<string>('franka')
  const [epochs, setEpochs] = useState<number>(200)
  const [registerId, setRegisterId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [detail, setDetail] = useState<Experiment | null>(null)
  const [filterRobot, setFilterRobot] = useState<string>('')  // '' = 전체

  // Leaderboard endpoint powers the per-robot view; '전체' uses the full list.
  const { data: leaderboard = [] } = useLeaderboard(filterRobot || undefined, 20)
  const rows = useMemo(
    () => filterRobot
      ? leaderboard
      : [...experiments].sort((a, b) => (b.success_rate ?? 0) - (a.success_rate ?? 0)),
    [filterRobot, leaderboard, experiments],
  )

  const dataset = useMemo(() => ROBOTS.find(r => r.key === robot)?.dataset ?? null, [robot])

  // GPU quota exhausted → block new runs (the backend enforces this too).
  const overQuota = !!usage && usage.gpu_minutes_remaining <= 0

  const onSubmit = () => {
    setActionErr(null)
    if (!user) { setAuthOpen(true); return }   // 로그인 필요
    submit({ algo, robot, dataset, hyperparams: { epochs } }, {
      onError: (e) => setActionErr(errMsg(e)),
    })
  }

  const onRegister = (exp: Experiment) => {
    setActionErr(null)
    if (!user) { setAuthOpen(true); return }
    setRegisterId(exp.id)
    register(exp.id, {
      onError: (e) => setActionErr(errMsg(e)),
      onSettled: () => setRegisterId(null),
    })
  }

  const onSetPlan = (key: string) => {
    setActionErr(null)
    if (!user) { setAuthOpen(true); return }
    setPlan(key, { onError: (e) => setActionErr(errMsg(e)) })
  }

  const onDelete = (exp: Experiment) => {
    setActionErr(null)
    if (!user) { setAuthOpen(true); return }
    if (!window.confirm(`'${exp.name}' 실험을 삭제하시겠습니까?\n추적 기록에서 영구 제거됩니다.`)) return
    setDeletingId(exp.id)
    deleteExp(exp.id, {
      onError: (e) => setActionErr(errMsg(e)),
      onSettled: () => setDeletingId(null),
    })
    if (detail?.id === exp.id) setDetail(null)
  }

  const util = usage?.utilization ?? 0
  const barColor = util > 0.9 ? 'bg-rose-500' : util > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-bold text-slate-200">MLOps — 학습 실험 추적 & 모델 레지스트리</h2>
        <p className="text-xs text-muted mt-0.5">
          학습 작업을 제출하고 메트릭을 추적한 뒤, 최고 성능 모델을 마켓플레이스에 등록합니다.
        </p>
      </div>

      {/* 로그인 안내 — 작업 제출·플랜 변경·마켓 등록은 인증이 필요 */}
      {!user && (
        <div className="bg-amber-950/40 border border-amber-900/60 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-amber-200">
            🔐 학습 작업 제출 · 플랜 변경 · 마켓 등록은 <span className="font-bold">로그인</span>이 필요합니다.
          </p>
          <button
            onClick={() => setAuthOpen(true)}
            className="text-[11px] font-bold px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 transition-colors whitespace-nowrap"
          >
            로그인 / 회원가입
          </button>
        </div>
      )}

      {/* Usage / plan meter */}
      {usage && (
        <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-300">구독 플랜</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-nvidia text-black">
                {usage.plan_name} · ${usage.price_usd}/mo
              </span>
            </div>
            <div className="flex gap-1">
              {Object.entries(usage.plans).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => onSetPlan(key)}
                  className={clsx(
                    'text-[10px] font-bold px-2 py-1 rounded transition-colors',
                    usage.plan === key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">GPU 사용량</span>
              <span className="font-mono text-slate-200">
                {usage.gpu_minutes_used.toLocaleString()} / {usage.gpu_minutes_quota.toLocaleString()} GPU-min
              </span>
            </div>
            <div className="h-2 bg-[#0d1117] rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(100, util * 100)}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#0d1117] rounded px-2 py-1.5">
              <p className="text-[10px] text-slate-500">실험</p>
              <p className="text-sm font-black text-slate-100">{usage.experiments}</p>
            </div>
            <div className="bg-[#0d1117] rounded px-2 py-1.5">
              <p className="text-[10px] text-slate-500">등록 모델</p>
              <p className="text-sm font-black text-indigo-300">{usage.registered_models}</p>
            </div>
            <div className="bg-[#0d1117] rounded px-2 py-1.5">
              <p className="text-[10px] text-slate-500">잔여 GPU-min</p>
              <p className="text-sm font-black text-emerald-300">{usage.gpu_minutes_remaining.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Submit a run */}
      <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-[11px] font-bold text-slate-300">▶ 새 학습 작업 제출</h3>
        {overQuota && (
          <p className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded px-3 py-2">
            ⚠ GPU 쿼터를 모두 소진했습니다 ({usage?.gpu_minutes_used.toLocaleString()} / {usage?.gpu_minutes_quota.toLocaleString()} GPU-min). 플랜을 업그레이드하면 새 작업을 제출할 수 있습니다.
          </p>
        )}
        {actionErr && (
          <p className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded px-3 py-2">
            ⚠ {actionErr}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">알고리즘</span>
            <select value={algo} onChange={e => setAlgo(e.target.value)}
              className="bg-[#0d1117] border border-border rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-400">
              {ALGOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">로봇</span>
            <select value={robot} onChange={e => setRobot(e.target.value)}
              className="bg-[#0d1117] border border-border rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-400">
              {ROBOTS.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">학습 데이터</span>
            <span className="text-xs font-mono text-indigo-200 bg-indigo-950/50 border border-indigo-900/50 rounded px-2 py-1.5">🧬 {dataset}</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">에포크</span>
            <input type="number" min={5} max={1000} value={epochs}
              onChange={e => setEpochs(Math.max(5, Math.min(1000, Number(e.target.value) || 5)))}
              className="w-24 bg-[#0d1117] border border-border rounded px-2 py-1.5 text-xs text-slate-200 text-right focus:outline-none focus:border-indigo-400" />
          </label>
          <button onClick={onSubmit} disabled={submitting || overQuota}
            title={overQuota ? 'GPU 쿼터 소진 — 플랜을 업그레이드하세요' : !user ? '로그인이 필요합니다' : ''}
            className="text-xs font-bold py-2 px-4 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? '학습 중…' : overQuota ? '쿼터 소진' : !user ? '🔐 로그인 후 학습' : '학습 시작'}
          </button>
        </div>
      </div>

      {/* Experiments table / leaderboard */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-[11px] font-bold text-slate-300">
            {filterRobot ? '🏆 리더보드' : '📊 실험 추적'} ({rows.length})
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">성공률 순</span>
            <select value={filterRobot} onChange={e => setFilterRobot(e.target.value)}
              className="bg-[#0d1117] border border-border rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-400">
              <option value="">전체</option>
              {ROBOTS.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
          </div>
        </div>
        {isLoading ? (
          <p className="text-slate-600 text-xs py-8 text-center">로딩 중...</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-600 text-xs py-8 text-center">
            {filterRobot ? '이 로봇의 실험이 없습니다' : '아직 실험이 없습니다 — 위에서 학습 작업을 제출하세요'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-slate-500 border-b border-border">
                  {filterRobot && <th className="text-right font-semibold px-3 py-2">#</th>}
                  <th className="text-left font-semibold px-4 py-2">실험</th>
                  <th className="text-left font-semibold px-2 py-2">알고</th>
                  <th className="text-right font-semibold px-2 py-2">성공률</th>
                  <th className="text-right font-semibold px-2 py-2">평균보상</th>
                  <th className="text-center font-semibold px-2 py-2">학습곡선</th>
                  <th className="text-right font-semibold px-2 py-2">GPU-s</th>
                  <th className="text-right font-semibold px-2 py-2">레지스트리</th>
                  <th className="text-center font-semibold px-3 py-2">삭제</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((exp, i) => (
                  <tr key={exp.id} onClick={() => setDetail(exp)}
                    className="border-b border-border/50 hover:bg-[#0d1117]/50 cursor-pointer">
                    {filterRobot && (
                      <td className="px-3 py-2.5 text-right font-black text-slate-400">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-200">{exp.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">🧬 {exp.dataset ?? '—'}</p>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={clsx('text-[9px] font-black px-1.5 py-0.5 rounded', ALGO_COLOR[exp.algo] ?? 'text-slate-300 bg-slate-800')}>{exp.algo}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-bold text-emerald-300">{fmtPct(exp.success_rate)}</td>
                    <td className="px-2 py-2.5 text-right text-slate-200">{exp.mean_reward ?? '—'}</td>
                    <td className="px-2 py-2.5"><div className="flex justify-center"><Sparkline curve={exp.curve} /></div></td>
                    <td className="px-2 py-2.5 text-right text-slate-400 font-mono">{exp.gpu_seconds}</td>
                    <td className="px-2 py-2.5 text-right">
                      {exp.registered_policy_id ? (
                        <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950 px-2 py-1 rounded">✓ 등록됨</span>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); onRegister(exp) }} disabled={registering && registerId === exp.id}
                          title="이 체크포인트를 마켓플레이스에 판매용 정책으로 등록"
                          className="text-[10px] font-bold text-nvidia bg-nvidia/15 border border-nvidia/30 px-2 py-1 rounded hover:bg-nvidia/25 transition-colors disabled:opacity-50">
                          {registering && registerId === exp.id ? '등록 중…' : '→ 마켓 등록'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={e => { e.stopPropagation(); onDelete(exp) }} disabled={deletingId === exp.id}
                        title="실험을 추적 기록에서 삭제"
                        className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40">
                        {deletingId === exp.id ? '…' : '🗑'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && <ExperimentDetailModal exp={detail} onClose={() => setDetail(null)} />}
      {authOpen && <AuthModal initialMode="login" onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

/** Full-detail modal for one run: learning curve + config + metrics + lineage. */
function ExperimentDetailModal({ exp, onClose }: { exp: Experiment; onClose: () => void }) {
  const robotName = ROBOTS.find(r => r.key === exp.robot)?.name ?? exp.robot
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-panel border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-start justify-between gap-3 sticky top-0 bg-panel">
          <div>
            <h3 className="text-sm font-bold text-slate-100">{exp.name}</h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{exp.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-lg leading-none">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Key metrics */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-[#0d1117] rounded px-2 py-2">
              <p className="text-[10px] text-slate-500">성공률</p>
              <p className="text-sm font-black text-emerald-300">{fmtPct(exp.success_rate)}</p>
            </div>
            <div className="bg-[#0d1117] rounded px-2 py-2">
              <p className="text-[10px] text-slate-500">평균보상</p>
              <p className="text-sm font-black text-slate-100">{exp.mean_reward ?? '—'}</p>
            </div>
            <div className="bg-[#0d1117] rounded px-2 py-2">
              <p className="text-[10px] text-slate-500">최종 Loss</p>
              <p className="text-sm font-black text-amber-300">{exp.final_loss ?? '—'}</p>
            </div>
            <div className="bg-[#0d1117] rounded px-2 py-2">
              <p className="text-[10px] text-slate-500">에포크</p>
              <p className="text-sm font-black text-slate-100">{exp.epochs ?? '—'}</p>
            </div>
          </div>

          {/* Learning curve */}
          <div>
            <p className="text-[11px] font-bold text-slate-300 mb-2">학습 곡선</p>
            {exp.curve.length ? (
              <div className="bg-[#0d1117] rounded-lg p-2" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={exp.curve} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="epoch" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#334155" />
                    <YAxis yAxisId="left" domain={[0, 1]} tick={{ fontSize: 10, fill: '#64748b' }} stroke="#334155" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#334155" />
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line yAxisId="left" type="monotone" dataKey="success_rate" name="성공률" stroke="#34d399" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="loss" name="Loss" stroke="#fbbf24" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-slate-600 text-xs py-4 text-center bg-[#0d1117] rounded-lg">학습 곡선 데이터가 없습니다</p>
            )}
          </div>

          {/* Config + lineage */}
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="flex flex-col gap-1.5">
              <Row k="로봇" v={robotName} />
              <Row k="알고리즘" v={exp.algo} />
              <Row k="학습 데이터" v={`🧬 ${exp.dataset ?? '—'}`} />
              <Row k="상태" v={exp.status ?? '—'} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Row k="GPU 사용" v={`${exp.gpu_seconds} s`} />
              <Row k="생성" v={exp.created_at ? new Date(exp.created_at * 1000).toLocaleString() : '—'} />
              <Row k="등록 정책"
                v={exp.registered_policy_id
                  ? <a href={`/api/policies/${exp.registered_policy_id}/download`}
                      className="text-indigo-300 hover:underline font-mono">{exp.registered_policy_id}</a>
                  : '미등록'} />
            </div>
          </div>

          {/* Hyperparameters */}
          {exp.hyperparams && Object.keys(exp.hyperparams).length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-300 mb-1.5">하이퍼파라미터</p>
              <pre className="bg-[#0d1117] rounded-lg p-3 text-[10px] text-slate-300 font-mono overflow-x-auto">
{JSON.stringify(exp.hyperparams, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-200 text-right truncate">{v}</span>
    </div>
  )
}
