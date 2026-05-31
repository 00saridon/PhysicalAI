import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { clsx } from 'clsx'
import { LogPanel } from '../components/monitoring/LogPanel'
import { useSSELogs } from '../hooks/useSSELogs'
import { useSSEMetrics } from '../hooks/useSSEMetrics'

type Metric = 'rew_mean' | 'loss'

export function Training() {
  const [metric, setMetric] = useState<Metric>('rew_mean')
  const { lines, connected } = useSSELogs('/api/logs/stream')
  const { points } = useSSEMetrics('/api/metrics/stream')

  const rlPoints = points.filter(p => p.stage === 'rl' && p.rew_mean !== undefined)
  const ilPoints = points.filter(p => p.stage === 'il' && p.loss !== undefined)
  const filtered  = metric === 'rew_mean' ? rlPoints : ilPoints

  const lastRew  = rlPoints[rlPoints.length - 1]?.rew_mean
  const lastLoss = ilPoints[ilPoints.length - 1]?.loss
  const lastRlStep = rlPoints[rlPoints.length - 1]?.step
  const lastIlEpoch = ilPoints[ilPoints.length - 1]?.step

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* 요약 KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'RL Reward',   value: lastRew   !== undefined ? lastRew.toFixed(4)   : '—', sub: lastRlStep   ? `Step ${lastRlStep.toLocaleString()}`   : 'Not started', color: 'text-violet-400' },
          { label: 'IL Loss',     value: lastLoss  !== undefined ? lastLoss.toFixed(4)  : '—', sub: lastIlEpoch  ? `Epoch ${lastIlEpoch}`                  : 'Not started', color: 'text-sky-400'    },
          { label: 'RL Points',   value: rlPoints.length, sub: 'collected',  color: 'text-slate-300' },
          { label: 'IL Points',   value: ilPoints.length, sub: 'collected',  color: 'text-slate-300' },
        ].map(k => (
          <div key={k.label} className="bg-panel border border-border rounded-xl p-4">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* 메트릭 차트 (큰 버전) */}
      <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted uppercase tracking-widest">Training Metrics</p>
          <div className="flex gap-1">
            {(['rew_mean', 'loss'] as Metric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={clsx(
                  'text-[10px] font-bold px-3 py-1 rounded transition-colors',
                  metric === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                )}
              >
                {m === 'rew_mean' ? '▶ RL Reward' : '📉 IL Loss'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64">
          {filtered.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-xs">
              {metric === 'rew_mean' ? 'RL 스테이지를 실행하면 리워드 곡선이 표시됩니다' : 'IL 스테이지를 실행하면 Loss 곡선이 표시됩니다'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filtered} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
                <XAxis dataKey="step" stroke="#475569" tick={{ fontSize: 10 }} label={{ value: metric === 'rew_mean' ? 'Step' : 'Epoch', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3148', fontSize: 11 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                <Line
                  type="monotone"
                  dataKey={metric}
                  name={metric === 'rew_mean' ? 'Reward Mean' : 'Loss'}
                  stroke={metric === 'rew_mean' ? '#a78bfa' : '#38bdf8'}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 라이브 로그 */}
      <LogPanel lines={lines} connected={connected} />
    </div>
  )
}
