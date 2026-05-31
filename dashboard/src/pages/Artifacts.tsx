import { useState } from 'react'
import { clsx } from 'clsx'
import { useArtifacts } from '../hooks/usePipeline'
import { api } from '../api/client'
import type { Artifact } from '../types/pipeline'

const ICON: Record<Artifact['type'], string> = {
  onnx: '🧠', hdf5: '📦', pt: '💾', zip: '🗜',
}

const TYPE_COLOR: Record<Artifact['type'], string> = {
  onnx: 'text-violet-400 bg-violet-950',
  hdf5: 'text-amber-400 bg-amber-950',
  pt:   'text-sky-400 bg-sky-950',
  zip:  'text-emerald-400 bg-emerald-950',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const ALL_TYPES = ['all', 'onnx', 'hdf5', 'pt', 'zip'] as const
type Filter = typeof ALL_TYPES[number]

export function Artifacts() {
  const { data: artifacts = [], isLoading } = useArtifacts()
  const [filter, setFilter] = useState<Filter>('all')

  const displayed = filter === 'all' ? artifacts : artifacts.filter(a => a.type === filter)
  const totalSize = displayed.reduce((s, a) => s + a.size_bytes, 0)

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* 헤더 + 필터 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-200">Artifacts</h2>
          <p className="text-xs text-muted mt-0.5">
            {displayed.length}개 파일 · {formatBytes(totalSize)}
          </p>
        </div>
        <div className="flex gap-1">
          {ALL_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={clsx(
                'text-[10px] font-bold px-2.5 py-1 rounded transition-colors uppercase',
                filter === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              )}
            >
              {t === 'all' ? 'All' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 타입별 요약 */}
      <div className="grid grid-cols-4 gap-3">
        {(['onnx', 'hdf5', 'pt', 'zip'] as Artifact['type'][]).map(t => {
          const count = artifacts.filter(a => a.type === t).length
          const size  = artifacts.filter(a => a.type === t).reduce((s, a) => s + a.size_bytes, 0)
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={clsx(
                'bg-panel border rounded-xl p-4 text-left transition-colors',
                filter === t ? 'border-indigo-500' : 'border-border hover:border-slate-600'
              )}
            >
              <p className="text-lg mb-1">{ICON[t]}</p>
              <p className={clsx('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded inline-block mb-2', TYPE_COLOR[t])}>
                {t.toUpperCase()}
              </p>
              <p className="text-sm font-bold text-slate-200">{count}</p>
              <p className="text-[10px] text-muted">{formatBytes(size)}</p>
            </button>
          )
        })}
      </div>

      {/* 아티팩트 목록 */}
      <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-2">
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
          {filter === 'all' ? '전체 목록' : `${filter.toUpperCase()} 파일`}
        </p>
        {isLoading ? (
          <p className="text-slate-600 text-xs py-4 text-center">로딩 중...</p>
        ) : displayed.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm mb-1">📭 파일 없음</p>
            <p className="text-slate-600 text-xs">export 스테이지를 실행하면 파일이 생성됩니다</p>
          </div>
        ) : (
          displayed.map(art => (
            <div key={art.id} className="flex items-center gap-3 px-4 py-3 bg-[#0d1117] rounded-lg border border-border">
              <span className="text-xl">{ICON[art.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{art.name}</p>
                <p className="text-[10px] text-slate-500">{art.path}</p>
              </div>
              <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', TYPE_COLOR[art.type])}>
                {art.type.toUpperCase()}
              </span>
              <span className="text-xs text-slate-500 flex-shrink-0 w-16 text-right">{formatBytes(art.size_bytes)}</span>
              <a
                href={api.artifactDownloadUrl(art.id)}
                download={art.name}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors flex-shrink-0"
              >
                ↓
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
