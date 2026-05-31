import type { Stage, StageId } from '../../types/pipeline'
import { StageButton } from './StageButton'

interface Props {
  stages: Stage[]
  onRun?: (id: StageId) => void
  disabled?: boolean
}

export function PipelineBar({ stages, onRun, disabled }: Props) {
  const doneCount = stages.filter(s => s.status === 'done').length
  const progress = Math.round((doneCount / stages.length) * 100)

  return (
    <div className="bg-panel border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Pipeline Control</p>
        <span className="text-[10px] font-bold text-nvidia">{doneCount}/{stages.length} 완료 · {progress}%</span>
      </div>
      <div className="flex items-start justify-between relative">
        <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-border" />
        {doneCount > 0 && (
          <div
            className="absolute top-5 left-[10%] h-0.5 bg-nvidia/50 transition-all duration-500"
            style={{ width: `${(doneCount / stages.length) * 80}%` }}
          />
        )}
        {stages.map((stage) => (
          <StageButton key={stage.id} stage={stage} onRun={onRun} disabled={disabled} />
        ))}
      </div>
    </div>
  )
}
