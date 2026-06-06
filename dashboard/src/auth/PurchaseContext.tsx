import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { LibraryModal } from '../components/auth/LibraryModal'

/** Post-purchase coordination, app-wide.
 *
 * Purchases happen inside the storefront pages (Datasets/Marketplace) but the
 * success toast and '내 보관함' modal live at the app shell. This context bridges
 * them: a page calls `notifyPurchase()` on a completed sale; the provider shows a
 * toast and, when the buyer clicks through (or is logged in), opens the library
 * with the freshly-issued license key highlighted. Stripe's `?paid=1` redirect is
 * handled here too, so both the mock and hosted flows converge on one UX. */

interface PurchaseInfo {
  name: string
  key: string  // empty when the key isn't known here (e.g. Stripe redirect)
}

interface PurchaseState {
  notifyPurchase: (info: PurchaseInfo) => void
  openLibrary: (highlightKey?: string) => void
}

const PurchaseContext = createContext<PurchaseState | null>(null)

export function PurchaseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [toast, setToast] = useState<PurchaseInfo | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [highlight, setHighlight] = useState<string | undefined>(undefined)

  const openLibrary = useCallback((highlightKey?: string) => {
    setHighlight(highlightKey)
    setLibraryOpen(true)
  }, [])

  const notifyPurchase = useCallback((info: PurchaseInfo) => setToast(info), [])

  // Auto-dismiss the toast after a few seconds.
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 9000)
    return () => clearTimeout(id)
  }, [toast])

  // Stripe hosted-checkout returns to `?paid=1`; surface a success toast once and
  // strip the param so a refresh doesn't re-trigger it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') === '1') {
      setToast({ name: '구매한 상품', key: '' })
      params.delete('paid')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])

  return (
    <PurchaseContext.Provider value={{ notifyPurchase, openLibrary }}>
      {children}
      {toast && (
        <PurchaseToast
          info={toast}
          loggedIn={!!user}
          onOpenLibrary={() => { openLibrary(toast.key || undefined); setToast(null) }}
          onClose={() => setToast(null)}
        />
      )}
      {libraryOpen && <LibraryModal highlightKey={highlight} onClose={() => setLibraryOpen(false)} />}
    </PurchaseContext.Provider>
  )
}

function PurchaseToast({ info, loggedIn, onOpenLibrary, onClose }: {
  info: PurchaseInfo
  loggedIn: boolean
  onOpenLibrary: () => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copyKey = () => {
    if (!info.key) return
    navigator.clipboard?.writeText(info.key).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-80 bg-panel border border-emerald-500/40 rounded-xl shadow-xl shadow-black/50 p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-400">✅ 구매 완료</p>
          <p className="text-[11px] text-slate-300 truncate mt-0.5">{info.name}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm leading-none flex-shrink-0">✕</button>
      </div>

      {info.key && (
        <button
          onClick={copyKey}
          title="클릭하여 라이선스 키 복사"
          className="text-left text-[10px] font-mono text-slate-400 bg-surface border border-border rounded px-2 py-1 hover:border-emerald-400 transition-colors"
        >
          {copied ? '✓ 복사됨' : `🔑 ${info.key}`}
        </button>
      )}

      {loggedIn ? (
        <button
          onClick={onOpenLibrary}
          className="text-[11px] font-bold py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
        >
          📚 보관함에서 받기
        </button>
      ) : (
        <p className="text-[10px] text-slate-500">
          로그인하면 구매 내역이 '내 보관함'에 저장돼 언제든 재다운로드할 수 있어요.
        </p>
      )}
    </div>
  )
}

export function usePurchase(): PurchaseState {
  const ctx = useContext(PurchaseContext)
  if (!ctx) throw new Error('usePurchase must be used within a PurchaseProvider')
  return ctx
}
