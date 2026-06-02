import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { DemoFile } from '../api/client'
import { usePipelineStatus, useRunStage } from '../hooks/usePipeline'
import { MODELS, MODEL_ICON, simSelection } from '../sim/models'
import type { NavPage } from '../App'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

function EpisodeRow({ demo }: { demo: DemoFile }) {
  const ep = demo.name.match(/episode_(\d+)/)?.[1] ?? '?'
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[#0d1117] rounded-lg border border-border">
      <span className="text-xl">🎬</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-200">{demo.name}</p>
        <p className="text-[10px] text-slate-500">{demo.path}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-slate-400">Episode {ep}</p>
        <p className="text-[10px] text-slate-600">{formatDate(demo.created_at)}</p>
      </div>
      <span className="text-xs text-slate-500 flex-shrink-0 w-16 text-right">{formatBytes(demo.size_bytes)}</span>
    </div>
  )
}

export function Demos({ onNav }: { onNav?: (p: NavPage) => void }) {
  const { data: demos = [], isLoading } = useQuery({
    queryKey: ['demos'],
    queryFn: api.getDemos,
    refetchInterval: 5000,
  })
  const { data: status } = usePipelineStatus()
  const { mutate: runStage, isPending } = useRunStage()

  const totalSize = demos.reduce((s, d) => s + d.size_bytes, 0)

  const openInSim = (id: string) => { simSelection.id = id; onNav?.('Simulation') }

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Robot model gallery (Isaac Lab showroom) */}
      <div className="bg-panel border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Robot Model Gallery</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">Isaac Lab 쇼룸 모델 · 클릭하면 3D 시뮬레이션</p>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full border border-nvidia/30 text-nvidia bg-nvidia/5 font-bold">{MODELS.length} models</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MODELS.map(m => (
            <button key={m.id} onClick={() => openInSim(m.id)}
              className="group rounded-xl border border-border bg-surface hover:border-nvidia/50 hover:bg-nvidia/5 p-3 flex flex-col gap-1.5 text-left transition-all">
              <div className="flex items-center justify-between">
                <span className="text-2xl leading-none">{MODEL_ICON[m.id] ?? '🤖'}</span>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${m.dataDriven ? 'bg-nvidia/15 text-nvidia' : 'bg-slate-800 text-slate-500'}`}>
                  {m.dataDriven ? 'DATA' : 'PROC'}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-200 leading-tight group-hover:text-nvidia">{m.name}</p>
                <p className="text-[8px] text-muted">{m.category} · {m.dof} DOF</p>
              </div>
              <p className="text-[8px] text-nvidia/70 font-bold opacity-0 group-hover:opacity-100 transition-opacity">3D 보기 →</p>
            </button>
          ))}
        </div>
      </div>

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-200">Demo Datasets</h2>
          <p className="text-xs text-muted mt-0.5">
            {demos.length > 0
              ? `${demos.length}개 에피소드 · 총 ${formatBytes(totalSize)}`
              : '수집된 데모가 없습니다'}
          </p>
        </div>
        <button
          onClick={() => runStage({ stage: 'collect' })}
          disabled={status?.running || isPending}
          className={`text-xs font-semibold px-4 py-2 rounded-md transition-colors ${
            status?.running || isPending
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {status?.running && status.stage === 'collect' ? '⟳ Collecting...' : '▶ Collect 실행'}
        </button>
      </div>

      {/* 수집 안내 카드 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '🎮', title: 'Random', desc: '랜덤 액션으로 빠르게 데이터 수집' },
          { icon: '🕹', title: 'Teleop', desc: '키보드로 직접 로봇 조종' },
          { icon: '🤖', title: 'Rollout', desc: '학습된 정책으로 자동 수집' },
        ].map(m => (
          <div key={m.title} className="bg-panel border border-border rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">{m.icon}</p>
            <p className="text-xs font-bold text-slate-300">{m.title}</p>
            <p className="text-[10px] text-muted mt-1">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* 에피소드 목록 */}
      <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-2">
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Episodes</p>
        {isLoading ? (
          <p className="text-slate-600 text-xs py-4 text-center">로딩 중...</p>
        ) : demos.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm mb-1">🎬 수집된 데모 없음</p>
            <p className="text-slate-600 text-xs">위 "Collect 실행" 버튼으로 데이터를 수집하세요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {demos.map(d => <EpisodeRow key={d.path} demo={d} />)}
          </div>
        )}
      </div>
    </div>
  )
}
