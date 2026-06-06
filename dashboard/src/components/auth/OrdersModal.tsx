import { useEffect, useState } from 'react'
import { api, type Orders } from '../../api/client'
import { getAuthToken } from '../../api/base'

/** 주문 내역 — the member's purchase history (date · product · amount) with a
 * downloadable personal receipt (CSV). Presented as a wide, page-like panel. */
export function OrdersModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Orders | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) { setErr('로그인이 필요합니다.'); return }
    api.getOrders(token)
      .then(setData)
      .catch(() => setErr('주문 내역을 불러오지 못했습니다.'))
  }, [])

  const fmtDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

  const handleExport = async () => {
    const token = getAuthToken()
    if (!token) return
    setExporting(true)
    try {
      const blob = await api.getOrdersCsv(token)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `odin-receipt-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="mt-16 w-full max-w-3xl bg-panel border border-border rounded-xl p-6 flex flex-col gap-4 max-h-[82vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-200">🧾 주문 내역</h2>
            {data && (
              <p className="text-[11px] text-muted mt-0.5">
                {data.email} · {data.count}건 · 총 ${data.total_usd.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || !data || data.count === 0}
              className="text-[11px] font-bold px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-40"
            >
              {exporting ? '내보내는 중…' : '⬇ 영수증 CSV'}
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
          </div>
        </div>

        {err && <p className="text-[11px] text-rose-400">{err}</p>}

        {!data && !err && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map(i => <div key={i} className="h-10 rounded bg-border/40 animate-pulse" />)}
          </div>
        )}

        {data && data.count === 0 && (
          <p className="text-xs text-muted text-center py-10">
            아직 결제한 주문이 없습니다.<br />
            <span className="text-slate-500">Datasets / Marketplace에서 구매하면 여기에 기록됩니다.</span>
          </p>
        )}

        {data && data.count > 0 && (
          <div className="overflow-y-auto -mx-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] uppercase text-slate-500 border-b border-border">
                  <th className="font-bold px-2 py-2">결제일</th>
                  <th className="font-bold px-2 py-2">상품</th>
                  <th className="font-bold px-2 py-2 hidden sm:table-cell">종류</th>
                  <th className="font-bold px-2 py-2 text-right">금액</th>
                  <th className="font-bold px-2 py-2 hidden md:table-cell">라이선스 키</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o, i) => (
                  <tr key={`${o.license_key}-${o.product_id}-${i}`} className="border-b border-border/50 hover:bg-border/20">
                    <td className="px-2 py-2 text-[11px] text-slate-400 whitespace-nowrap">{fmtDate(o.granted_at)}</td>
                    <td className="px-2 py-2 text-xs text-slate-200">
                      {o.name}
                      <span className="block sm:hidden text-[10px] text-slate-500">
                        {o.kind === 'policy' ? '🧠 정책' : '📦 데이터셋'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-400 hidden sm:table-cell">
                      {o.kind === 'policy' ? '🧠 정책' : '📦 데이터셋'}
                    </td>
                    <td className="px-2 py-2 text-xs font-bold text-emerald-400 text-right whitespace-nowrap">
                      ${o.price_usd.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-[10px] font-mono text-slate-500 hidden md:table-cell">{o.license_key}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-xs font-bold text-slate-200">
                  <td className="px-2 py-2.5" colSpan={3}>합계</td>
                  <td className="px-2 py-2.5 text-right text-emerald-400">${data.total_usd.toLocaleString()}</td>
                  <td className="hidden md:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
