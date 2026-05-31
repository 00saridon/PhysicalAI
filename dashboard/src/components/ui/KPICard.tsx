import { clsx } from 'clsx'

interface Props {
  label: string
  value: string | number
  sub?: string
  subColor?: 'green' | 'amber' | 'muted'
}

const SUB_COLORS = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  muted: 'text-slate-500',
}

export function KPICard({ label, value, sub, subColor = 'muted' }: Props) {
  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-100 mb-1">{value}</p>
      {sub && <p className={clsx('text-xs', SUB_COLORS[subColor])}>{sub}</p>}
    </div>
  )
}
