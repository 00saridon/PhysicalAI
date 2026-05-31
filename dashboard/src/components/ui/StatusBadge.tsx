import { clsx } from 'clsx'
import type { StageStatus } from '../../types/pipeline'

const STYLES: Record<StageStatus, string> = {
  done: 'bg-emerald-900 text-emerald-400',
  running: 'bg-indigo-900 text-indigo-300 animate-pulse',
  pending: 'bg-slate-800 text-slate-500',
  error: 'bg-red-950 text-red-400',
}

interface Props { status: StageStatus; className?: string }

export function StatusBadge({ status, className }: Props) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-bold', STYLES[status], className)}>
      {status}
    </span>
  )
}
