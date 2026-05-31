import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { clsx } from 'clsx'
import type { MetricPoint } from '../../types/pipeline'

type Metric = 'rew_mean' | 'loss'

interface Props { points: MetricPoint[] }

export function RewardChart({ points }: Props) {
  const [metric, setMetric] = useState<Metric>('rew_mean')

  const filtered = points.filter(p => p[metric] !== undefined)

  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted uppercase tracking-widest">Training Metrics</p>
        <div className="flex gap-1">
          {(['rew_mean', 'loss'] as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={clsx(
                'text-[10px] font-bold px-2 py-0.5 rounded',
                metric === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              )}
            >
              {m === 'rew_mean' ? 'Reward' : 'Loss'}
            </button>
          ))}
        </div>
      </div>
      <div className="h-36">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs">
            Waiting for training data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filtered} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
              <XAxis dataKey="step" stroke="#475569" tick={{ fontSize: 10 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3148', fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="#76b900"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
