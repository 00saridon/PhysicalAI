import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Stage, StageId } from '../types/pipeline'
import { PipelineBar } from '../components/pipeline/PipelineBar'
import { usePipelineStatus, useRunStage, useStopStage } from '../hooks/usePipeline'
import { useSSELogs } from '../hooks/useSSELogs'
import { getApiBase, getApiRoot } from '../api/base'
import { ResourceBadge } from '../components/ui/ResourceBadge'

// _fetch throws "<status> <statusText>: <body>" where body is FastAPI's
// {"detail": "..."}. Pull the human-readable detail out for the error banner.
function friendlyError(err: Error): string {
  // TypeError "Failed to fetch" = the request never reached the backend
  // (offline backend, dead tunnel, or CORS), not an HTTP error.
  if (/failed to fetch|networkerror|load failed/i.test(err.message)) {
    return `백엔드에 연결할 수 없습니다 (${getApiRoot() || '기본 백엔드'}). ` +
           `백엔드가 오프라인이거나 주소가 잘못됐습니다 — Resources에서 GPU(기본)로 전환하거나 백엔드를 다시 연결하세요.`
  }
  const m = err.message.match(/\{.*\}$/)
  if (m) {
    try {
      const detail = JSON.parse(m[0]).detail
      if (typeof detail === 'string') return detail
    } catch {}
  }
  return err.message
}

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

// Full pipeline order. "전체 실행"이 env → … → export 순서로 자동 진행됩니다.
const FULL_ORDER: StageId[] = ['env', 'collect', 'il', 'rl', 'export']

export function Run() {
  const qc = useQueryClient()
  const { data: status } = usePipelineStatus()
  const { mutate: runStage, isPending, error, reset } = useRunStage()
  const { mutate: stopStage, isPending: isStopping } = useStopStage()
  const apiBase = getApiBase()

  // "전체 파이프라인 실행" 상태: autoRun이 켜져 있으면 한 스테이지가 끝날 때마다
  // 큐의 다음 스테이지를 자동으로 시작합니다(에러/중지 시 중단).
  const [autoRun, setAutoRun] = useState(false)
  const queueRef = useRef<StageId[]>([])

  const runOne = (id: StageId) => runStage({ stage: id, validate: id === 'env' })

  const startFullRun = () => {
    reset()
    queueRef.current = FULL_ORDER.slice(1)  // env 다음부터 큐에 적재
    setAutoRun(true)
    runOne('env')
  }

  const stopAll = () => {
    queueRef.current = []
    setAutoRun(false)
    stopStage()
  }

  // When a stage finishes/fails the server emits a terminal SSE event; refetch
  // status immediately instead of waiting up to 2s for the next poll — and, if a
  // full run is in progress, advance the queue (or abort on error/stop).
  const { lines, connected } = useSSELogs(`${apiBase}/logs/stream`, (info) => {
    qc.invalidateQueries({ queryKey: ['pipeline-status'] })
    if (!autoRun) return
    if (info.event === 'error' || info.stopped) {
      queueRef.current = []
      setAutoRun(false)
      return
    }
    const next = queueRef.current.shift()
    if (next) runOne(next)
    else setAutoRun(false)  // export 완료 → 전체 실행 종료
  })

  // Safety net / recovery: during a full run the chaining is normally driven by
  // the terminal SSE event (see useSSELogs callback). But if that event is missed
  // (reconnect, flaky stream) the pipeline goes idle with stages still queued and
  // the UI would otherwise hang forever in "AUTO". So whenever a full run is active
  // and the pipeline has been idle (not running, no start in flight) for 3s, we
  // recover here: launch the next queued stage, or end the run if the queue is
  // empty. The `isPending` guard + the 3s debounce avoid racing an in-flight start
  // or the brief idle gap between chained stages (status poll flips to running well
  // within 3s on a healthy stream, cancelling this timer before it fires).
  useEffect(() => {
    if (!autoRun || status?.running || isPending) return
    const t = setTimeout(() => {
      if (status?.running || isPending) return
      const next = queueRef.current.shift()
      if (next) runOne(next)
      else setAutoRun(false)
    }, 3000)
    return () => clearTimeout(t)
  }, [autoRun, status?.running, isPending])

  const stages: Stage[] = STAGE_DEFS.map(def => ({
    ...def,
    status: status?.stage === def.id ? 'running' : 'pending',
    detail: '',
  }))

  const stageIdx = status?.stage ? FULL_ORDER.indexOf(status.stage) + 1 : 0
  const idle = !status?.running && !autoRun

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* 자원(CPU/GPU/Colab GPU) 표기 */}
      <ResourceBadge className="self-start" />

      {/* 상태 배너 + 실행 컨트롤 (헤더에서 이전된 1차 액션) */}
      <div className="bg-panel border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${status?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-200">
            {status?.running
              ? `${status.stage?.toUpperCase()} 실행 중${autoRun ? ` · 전체 실행 ${stageIdx}/${FULL_ORDER.length}` : ''}`
              : '대기 중 (Idle)'}
          </p>
          <p className="text-xs text-muted">
            {status?.running && status.stage
              ? STAGE_DESC[status.stage]
              : '전체 파이프라인을 한 번에 실행하거나, 아래 바에서 스테이지를 개별 실행하세요'}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {idle && (
            <button
              onClick={startFullRun}
              disabled={isPending}
              title="ENV → COLLECT → IL → RL → EXPORT 를 순서대로 자동 실행"
              className="text-xs font-bold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
            >
              ▶ 전체 파이프라인 실행 <span className="hidden sm:inline font-normal opacity-80">(ENV→EXPORT)</span>
            </button>
          )}
          {status?.running && (
            <>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-900 text-emerald-300 animate-pulse">
                {autoRun ? 'AUTO' : 'RUNNING'}
              </span>
              <button
                onClick={stopAll}
                disabled={isStopping}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white transition-colors"
              >
                {isStopping ? '중지 중…' : autoRun ? '■ 전체 중지' : '■ 중지'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 실행 명령 에러 (예: 선행 산출물 누락 422, 이미 실행 중 409) */}
      {error && (
        <div className="bg-red-950/60 border border-red-800 rounded-xl p-3 flex items-start gap-3">
          <span className="text-red-400 text-sm font-bold flex-shrink-0">⚠</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-red-300">스테이지를 시작할 수 없습니다</p>
            <p className="text-xs text-red-400/90 break-all">{friendlyError(error as Error)}</p>
          </div>
          <button
            onClick={() => reset()}
            className="flex-shrink-0 text-red-400 hover:text-red-200 text-sm leading-none"
            aria-label="dismiss"
          >✕</button>
        </div>
      )}

      {/* 파이프라인 실행 바 */}
      <PipelineBar
        stages={stages}
        onRun={id => runStage({ stage: id, validate: id === 'env' })}
        disabled={status?.running || isPending || autoRun}
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
