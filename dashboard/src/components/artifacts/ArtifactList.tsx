import type { Artifact } from '../../types/pipeline'
import { api } from '../../api/client'

const ICON: Record<Artifact['type'], string> = {
  onnx: '🧠', hdf5: '📦', pt: '💾', zip: '🗜',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

interface Props { artifacts: Artifact[] }

export function ArtifactList({ artifacts }: Props) {
  if (artifacts.length === 0) {
    return (
      <div className="bg-panel border border-border rounded-xl p-4">
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Artifacts</p>
        <p className="text-slate-600 text-xs">No artifacts yet. Run the export stage.</p>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Artifacts</p>
      <div className="flex flex-col gap-2">
        {artifacts.map(art => (
          <div key={art.id} className="flex items-center gap-3 px-3 py-2 bg-[#0d1117] rounded-lg border border-border">
            <span className="text-xl">{ICON[art.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{art.name}</p>
              <p className="text-[10px] text-slate-500">{art.path}</p>
            </div>
            <span className="text-xs text-slate-500 flex-shrink-0">{formatBytes(art.size_bytes)}</span>
            <a
              href={api.artifactDownloadUrl(art.id)}
              download={art.name}
              className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
            >
              ↓
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
