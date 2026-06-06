import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { api, type Library, type LibraryItem } from '../../api/client'
import { getAuthToken } from '../../api/base'

/** '내 보관함' — the buyer's owned datasets/policies with license keys + re-download links.
 * `highlightKey` flags a just-purchased license so the new item stands out + auto-scrolls. */
export function LibraryModal({ onClose, highlightKey }: { onClose: () => void; highlightKey?: string }) {
  const [lib, setLib] = useState<Library | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) { setErr('로그인이 필요합니다.'); return }
    api.getLibrary(token)
      .then(setLib)
      .catch(() => setErr('보관함을 불러오지 못했습니다.'))
  }, [])

  // Once the highlighted (newly purchased) item renders, scroll it into view.
  useEffect(() => {
    if (lib && highlightKey) highlightRef.current?.scrollIntoView({ block: 'nearest' })
  }, [lib, highlightKey])

  const downloadUrl = (it: LibraryItem) =>
    it.kind === 'policy'
      ? api.policyDownloadUrl(it.product_id, it.license_key)
      : api.catalogDownloadUrl(it.product_id, it.license_key)

  const copyKey = (key: string) => {
    navigator.clipboard?.writeText(key).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60" onClick={onClose}>
      <div
        className="mt-20 w-full max-w-lg bg-panel border border-border rounded-xl p-6 flex flex-col gap-4 max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">📚 내 보관함</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        {err && <p className="text-[11px] text-rose-400">{err}</p>}

        {!lib && !err && (
          <div className="flex flex-col gap-2">
            {[0, 1].map(i => <div key={i} className="h-14 rounded-lg bg-border/40 animate-pulse" />)}
          </div>
        )}

        {lib && lib.items.length === 0 && (
          <p className="text-xs text-muted text-center py-8">
            아직 구매한 데이터셋·정책이 없습니다.<br />
            <span className="text-slate-500">Datasets / Marketplace에서 구매하면 여기에 표시됩니다.</span>
          </p>
        )}

        {lib && lib.items.length > 0 && (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {lib.items.map(it => {
              const isNew = !!highlightKey && it.license_key === highlightKey
              return (
              <div
                key={`${it.product_id}-${it.license_key}`}
                ref={isNew ? highlightRef : undefined}
                className={clsx(
                  'border rounded-lg p-3 flex flex-col gap-2 transition-colors',
                  isNew ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-[#0d1117] border-border',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">
                      {it.name}
                      {isNew && <span className="ml-1.5 text-[9px] font-black text-emerald-400 align-middle">✨ 새 구매</span>}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {it.kind === 'policy' ? '🧠 정책' : '📦 데이터셋'} · {it.product_id}
                    </p>
                  </div>
                  <a
                    href={downloadUrl(it)}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white whitespace-nowrap flex-shrink-0"
                  >
                    ↓ 다운로드
                  </a>
                </div>
                <button
                  onClick={() => copyKey(it.license_key)}
                  title="클릭하여 라이선스 키 복사"
                  className="text-left text-[10px] font-mono text-slate-400 bg-surface border border-border rounded px-2 py-1 hover:border-indigo-400 transition-colors"
                >
                  {copied === it.license_key ? '✓ 복사됨' : `🔑 ${it.license_key}`}
                </button>
              </div>
              )
            })}
          </div>
        )}

        {lib && (
          <p className="text-[10px] text-slate-600 text-center">{lib.email} · {lib.items.length}개 항목</p>
        )}
      </div>
    </div>
  )
}
