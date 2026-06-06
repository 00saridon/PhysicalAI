import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { useQueryClient } from '@tanstack/react-query'
import { usePolicies, useEntitlements, useLibrary } from '../hooks/usePipeline'
import { api } from '../api/client'
import type { PolicyProduct } from '../api/client'
import { getLicenseKey, setLicenseKey } from '../api/base'
import { useAuth } from '../auth/AuthContext'
import { usePurchase } from '../auth/PurchaseContext'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const CATEGORY_ICON: Record<string, string> = {
  Manipulator: '🦾', Quadruped: '🐾', Humanoid: '🧍', Aerial: '🚁', Other: '🤖',
}

const ALGO_COLOR: Record<string, string> = {
  BC: 'text-sky-300 bg-sky-950',
  PPO: 'text-amber-300 bg-amber-950',
  SAC: 'text-fuchsia-300 bg-fuchsia-950',
}

function priceLabel(p: PolicyProduct): string {
  return p.tier === 'free' ? '무료' : `$${p.price_usd.toLocaleString()}`
}

interface CardProps {
  p: PolicyProduct
  downloadKey: string
  owned: boolean
  onBuy: (p: PolicyProduct) => void
  buying: boolean
}

function PolicyCard({ p, downloadKey, owned, onBuy, buying }: CardProps) {
  const paid = p.tier === 'paid'
  const sr = p.metrics.success_rate
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden flex flex-col hover:border-slate-600 transition-colors">
      {/* Header band */}
      <div className="relative h-24 bg-[#0d1117] flex items-center justify-center overflow-hidden">
        <span className="text-4xl opacity-60">{CATEGORY_ICON[p.category] ?? '🤖'}</span>
        <span className={clsx(
          'absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-full',
          paid ? 'bg-nvidia text-black' : 'bg-emerald-500 text-black'
        )}>
          {priceLabel(p)}
        </span>
        <span className={clsx('absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded', ALGO_COLOR[p.algo] ?? 'text-slate-300 bg-slate-800')}>
          {p.algo}
        </span>
        {paid && owned && (
          <span className="absolute bottom-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-black">
            ✓ 보유
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-100 truncate">{p.robot_name}</p>
            <p className="text-[11px] text-muted">{p.category} · {p.task}</p>
          </div>
          <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded flex-shrink-0">
            {p.format.toUpperCase()}
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px] mt-0.5">
          <div className="bg-[#0d1117] rounded px-2 py-1">
            <span className="text-slate-500">성공률</span>
            <p className="font-bold text-emerald-300">{sr != null ? `${(sr * 100).toFixed(0)}%` : '—'}</p>
          </div>
          <div className="bg-[#0d1117] rounded px-2 py-1">
            <span className="text-slate-500">평균 보상</span>
            <p className="font-bold text-slate-200">{p.metrics.mean_reward ?? '—'}</p>
          </div>
          <div className="bg-[#0d1117] rounded px-2 py-1">
            <span className="text-slate-500">학습 에피소드</span>
            <p className="font-bold text-slate-200">{p.metrics.episodes_trained?.toLocaleString() ?? '—'}</p>
          </div>
          <div className="bg-[#0d1117] rounded px-2 py-1">
            <span className="text-slate-500">I/O</span>
            <p className="font-bold text-slate-200">{p.obs_dim ?? '?'}→{p.action_dim ?? '?'}</p>
          </div>
        </div>

        {/* Lineage — the Model #1 ↔ #3 link */}
        {p.trained_on && (
          <div className="flex items-center gap-1.5 text-[10px] bg-indigo-950/50 border border-indigo-900/50 rounded px-2 py-1">
            <span className="text-indigo-400">🧬 학습 데이터</span>
            <span className="font-mono font-bold text-indigo-200 truncate">{p.trained_on}</span>
          </div>
        )}

        {/* License + size */}
        <p className="text-[10px] text-slate-500 mt-auto pt-1">
          📄 {p.license} · {formatBytes(p.size_bytes)}
        </p>

        {/* Action */}
        {!paid ? (
          <a
            href={api.policyDownloadUrl(p.id)}
            className="text-center text-xs font-bold py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            무료 다운로드 ↓
          </a>
        ) : owned ? (
          <a
            href={api.policyDownloadUrl(p.id, downloadKey)}
            className="text-center text-xs font-bold py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            다운로드 ↓
          </a>
        ) : (
          <button
            onClick={() => onBuy(p)}
            disabled={buying}
            title="결제 진행 — Stripe 키가 있으면 결제 페이지로, 없으면 모의 결제 창이 열립니다"
            className="text-xs font-bold py-2 rounded-md bg-nvidia/20 text-nvidia border border-nvidia/30 hover:bg-nvidia/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buying ? '발급 중…' : `${priceLabel(p)} · 구매`}
          </button>
        )}
      </div>
    </div>
  )
}

const FILTERS = ['all', 'free', 'paid'] as const
type Filter = typeof FILTERS[number]

export function Marketplace() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { notifyPurchase } = usePurchase()
  const { data: policies = [], isLoading } = usePolicies()
  const [filter, setFilter] = useState<Filter>('all')

  // License key — shared with the dataset catalog (same entitlement ledger).
  const [keyInput, setKeyInput] = useState(getLicenseKey())
  const [licenseKey, setKey] = useState(getLicenseKey())
  const { data: ents } = useEntitlements(licenseKey)

  // Account-linked library (by email) — auto-fills the key + reflects ownership
  // for a logged-in buyer without manual key entry.
  const { data: library } = useLibrary(!!user)

  // Checkout — product whose mock-pay dialog is open + busy state.
  const [checkoutFor, setCheckoutFor] = useState<PolicyProduct | null>(null)
  const [pendingSession, setPendingSession] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // product_id → unlocking license key (from the account library).
  const ownedKeyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const it of library?.items ?? []) m.set(it.product_id, it.license_key)
    return m
  }, [library])

  // Owned = key-based entitlements ∪ account library (email-based).
  const owned = useMemo(() => {
    const s = new Set((ents?.products ?? []).map(o => o.product_id))
    for (const it of library?.items ?? []) s.add(it.product_id)
    return s
  }, [ents, library])

  // On login, auto-fill the key from the account's most recent purchase.
  useEffect(() => {
    const items = library?.items ?? []
    if (items.length && !licenseKey) {
      const k = items[0].license_key
      setLicenseKey(k)
      setKey(k)
      setKeyInput(k)
    }
  }, [library, licenseKey])

  // On logout (logged-in → null), clear the account-filled key so it doesn't
  // leak to the next user. Only fires on the transition, not on every render.
  const wasLoggedIn = useRef(!!user)
  useEffect(() => {
    if (wasLoggedIn.current && !user) {
      setKey('')
      setKeyInput('')
      qc.invalidateQueries({ queryKey: ['entitlements'] })
    }
    wasLoggedIn.current = !!user
  }, [user, qc])

  const useKey = (k: string) => {
    setLicenseKey(k)
    setKey(k)
    setKeyInput(k)
    qc.invalidateQueries({ queryKey: ['entitlements'] })
    qc.invalidateQueries({ queryKey: ['library'] })
  }

  const applyKey = () => {
    setLicenseKey(keyInput.trim())
    setKey(keyInput.trim())
  }

  const handleCheckout = async (p: PolicyProduct) => {
    setBusyId(p.id)
    try {
      // Logged-in buyers auto-tag the purchase with their account email so it
      // shows up in '내 보관함' and follows the account across devices/keys.
      const sess = await api.createCheckout(p.id, user?.email, licenseKey || undefined)
      if (sess.mode === 'stripe' && sess.checkout_url) {
        window.location.href = sess.checkout_url
        return
      }
      setPendingSession(sess.session_id)
      setCheckoutFor(p)
    } finally {
      setBusyId(null)
    }
  }

  const closeCheckout = () => {
    setCheckoutFor(null)
    setPendingSession(null)
  }

  const confirmMockPay = async () => {
    if (!pendingSession) return
    setBusyId(checkoutFor?.id ?? null)
    try {
      const res = await api.mockPay(pendingSession)
      useKey(res.license_key)
      notifyPurchase({ name: checkoutFor?.robot_name || checkoutFor?.id || '정책', key: res.license_key })
      closeCheckout()
    } finally {
      setBusyId(null)
    }
  }

  const displayed = useMemo(
    () => (filter === 'all' ? policies : policies.filter(p => p.tier === filter)),
    [policies, filter],
  )
  const paidCount = policies.filter(p => p.tier === 'paid').length

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-200">Marketplace — 학습된 스킬/정책</h2>
          <p className="text-xs text-muted mt-0.5">
            {policies.length}개 정책 · 유료 {paidCount}종 · 데이터셋으로 학습된 즉시 배포 가능 모델
          </p>
        </div>
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'text-[10px] font-bold px-2.5 py-1 rounded transition-colors uppercase',
                filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              )}
            >
              {f === 'all' ? 'All' : f === 'free' ? '무료' : '유료'}
            </button>
          ))}
        </div>
      </div>

      {/* License key bar (shared entitlement ledger) */}
      <div className="flex items-center gap-2 flex-wrap bg-panel border border-border rounded-lg px-3 py-2">
        <span className="text-[11px] font-bold text-slate-400">🔑 라이선스 키</span>
        <input
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyKey() }}
          placeholder="ODIN-XXXX-XXXX-XXXX"
          className="flex-1 min-w-[180px] bg-[#0d1117] border border-border rounded px-2.5 py-1 text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-nvidia/40"
        />
        <button
          onClick={applyKey}
          className="text-[11px] font-bold px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
        >
          적용
        </button>
        {licenseKey && (
          <span className="text-[10px] text-emerald-400 font-semibold">
            {owned.size}개 보유 중
          </span>
        )}
        {user && (library?.items.length ?? 0) > 0 && (
          <span className="text-[10px] text-indigo-300 font-semibold" title="로그인 계정의 구매 내역과 연동되었습니다">
            🔗 계정 연동됨
          </span>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-slate-600 text-xs py-8 text-center">로딩 중...</p>
      ) : displayed.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-500 text-sm mb-1">📭 정책 없음</p>
          <p className="text-slate-600 text-xs">학습된 정책을 outputs/policy 에 내보내면 상품이 생성됩니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map(p => (
            <PolicyCard
              key={p.id}
              p={p}
              downloadKey={ownedKeyMap.get(p.id) ?? licenseKey}
              owned={owned.has(p.id)}
              onBuy={handleCheckout}
              buying={busyId === p.id}
            />
          ))}
        </div>
      )}

      {/* Checkout dialog (mock payment) */}
      {checkoutFor && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          onClick={closeCheckout}
        >
          <div
            className="bg-panel border border-border rounded-xl p-5 w-full max-w-sm flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">결제 (모의)</h3>
              <button onClick={closeCheckout} className="text-slate-400 hover:text-slate-200 text-lg leading-none">✕</button>
            </div>
            <div className="bg-[#0d1117] rounded-lg p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">{checkoutFor.robot_name}</p>
                <p className="text-[11px] text-muted">{checkoutFor.algo} · {checkoutFor.task} 정책</p>
              </div>
              <span className="text-base font-black text-nvidia flex-shrink-0 ml-2">{priceLabel(checkoutFor)}</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Stripe 키가 설정되지 않아 모의 결제로 진행됩니다. 결제 완료 시 라이선스 키가 발급되어 다운로드가 잠금 해제됩니다.
            </p>
            <button
              onClick={confirmMockPay}
              disabled={busyId === checkoutFor.id}
              className="w-full text-sm font-bold py-2.5 rounded-md bg-nvidia text-black hover:bg-nvidia/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busyId === checkoutFor.id ? '처리 중…' : `${priceLabel(checkoutFor)} 결제하기`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
