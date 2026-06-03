import { clsx } from 'clsx'
import { useSystem } from '../../hooks/usePipeline'
import { getApiOverride } from '../../api/base'

/** Compact box showing the active compute resource (CPU / GPU / Colab GPU) with
 *  live GPU stats. A backend reached via override (tunnel) reads as "Colab GPU". */
export function ResourceBadge({ className }: { className?: string }) {
  const q = useSystem()
  const sys = q.data
  const override = getApiOverride()
  const gpu = sys?.gpu?.available ? sys?.gpu?.gpus?.[0] : undefined
  const kind: 'off' | 'cpu' | 'gpu' | 'colab' =
    !q.isSuccess ? 'off' : gpu ? (override ? 'colab' : 'gpu') : 'cpu'

  const meta = {
    off:   { icon: '○', label: '백엔드 오프라인', text: 'text-slate-500', dot: 'bg-slate-600', border: 'border-border' },
    cpu:   { icon: '🖥', label: 'CPU',        text: 'text-sky-300',   dot: 'bg-sky-400',   border: 'border-sky-800/50' },
    gpu:   { icon: '⚡', label: 'GPU',        text: 'text-nvidia',    dot: 'bg-nvidia',    border: 'border-nvidia/40' },
    colab: { icon: '⚡', label: 'Colab GPU',  text: 'text-nvidia',    dot: 'bg-nvidia',    border: 'border-nvidia/40' },
  }[kind]

  return (
    <div className={clsx('flex items-center gap-2 bg-panel border rounded-lg px-3 py-1.5', meta.border, className)}>
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', meta.dot, kind !== 'off' && 'animate-pulse')} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Resource</span>
      <span className={clsx('text-xs font-bold', meta.text)}>{meta.icon} {meta.label}</span>
      {gpu && (
        <span className="text-[10px] text-muted truncate hidden sm:inline">
          · {gpu.name} · {gpu.util ?? 0}% · {(((gpu.mem_used ?? 0)) / 1024).toFixed(1)}/{((gpu.mem_total ?? 0) / 1024).toFixed(1)} GB
        </span>
      )}
      {kind === 'cpu' && sys?.host?.cpu_count != null && (
        <span className="text-[10px] text-muted hidden sm:inline">· {sys.host.platform} · {sys.host.cpu_count}코어</span>
      )}
    </div>
  )
}
