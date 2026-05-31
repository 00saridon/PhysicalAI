import type { Stage } from '../types/pipeline'
import { PipelineBar } from '../components/pipeline/PipelineBar'
import { usePipelineStatus, useRunStage } from '../hooks/usePipeline'
import { useSSELogs } from '../hooks/useSSELogs'

const STAGE_DEFS: Pick<Stage, 'id' | 'name'>[] = [
  { id: 'env', name: 'ENV' },
  { id: 'collect', name: 'COLLECT' },
  { id: 'il', name: 'IL' },
  { id: 'rl', name: 'RL' },
  { id: 'export', name: 'EXPORT' },
]

const STAGE_DESC: Record<string, string> = {
  env:     'Isaac 환경 초기화 및 센서 설정 검증',
  collect: '랜덤/텔레오퍼레이션으로 데모 데이터 수집',
  il:      'BC(Behavioral Cloning)으로 초기 정책 학습',
  rl:      'PPO/SAC로 정책 파인튜닝',
  export:  'ONNX 정책 + HDF5 데이터셋 내보내기',
}

export function Run() {
  const { data: status } = usePipelineStatus()
  const { mutate: runStage, isPending } = useRunStage()
  const apiBase = (import.meta.env.VITE_API_URL ?? '') + '/api'
  const { lines, connected } = useSSELogs(`${apiBase}/logs/stream`)

  const stages: Stage[] = STAGE_DEFS.map(def => ({
    ...def,
    status: status?.stage === def.id ? 'running' : 'pending',
    detail: '',
  }))

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* 상태 배너 */}
      <div className="bg-panel border border-border rounded-xl p-4 flex items-center gap-4">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${status?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
        <div>
          <p className="text-sm font-bold text-slate-200">
            {status?.running ? `${status.stage?.toUpperCase()} 실행 중` : '대기 중 (Idle)'}
          </p>
          <p className="text-xs text-muted">
            {status?.running && status.stage ? STAGE_DESC[status.stage] : '아래 스테이지 버튼을 눌러 파이프라인을 시작하세요'}
          </p>
        </div>
        {status?.running && (
          <span className="ml-auto text-xs font-bold px-3 py-1 rounded-full bg-emerald-900 text-emerald-300 animate-pulse">RUNNING</span>
        )}
      </div>

      {/* 파이프라인 실행 바 */}
      <PipelineBar
        stages={stages}
        onRun={id => runStage({ stage: id, validate: id === 'env' })}
        disabled={status?.running || isPending}
      />

      {/* 스테이지 설명 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {STAGE_DEFS.map(def => (
          <div
            key={def.id}
            className={`bg-panel border rounded-lg p-3 text-center ${
              status?.stage === def.id ? 'border-indigo-500' : 'border-border'
            }`}
          >
            <p className="text-xs font-bold text-slate-300 mb-1">{def.name}</p>
            <p className="text-[10px] text-muted leading-tight">{STAGE_DESC[def.id]}</p>
          </div>
        ))}
      </div>

      {/* 라이브 로그 (전체 높이) */}
      <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted uppercase tracking-widest">Live Log</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${connected ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <div className="bg-[#0d1117] rounded-md p-3 font-mono text-[11px] flex-1 min-h-[300px] overflow-y-auto flex flex-col gap-0.5">
          {lines.length === 0 ? (
            <p className="text-slate-600 m-auto text-xs">스테이지를 실행하면 여기에 로그가 출력됩니다</p>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-600 flex-shrink-0">{new Date(line.ts * 1000).toLocaleTimeString()}</span>
                <span className="text-slate-300 break-all">{line.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
