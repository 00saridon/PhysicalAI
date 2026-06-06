import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { useQueryClient } from '@tanstack/react-query'
import { useCatalog, useEntitlements, useLibrary } from '../hooks/usePipeline'
import { api } from '../api/client'
import type { CatalogProduct, GenerateSpec } from '../api/client'
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

const SENSOR_LABEL: Record<string, string> = {
  rgb: 'RGB', depth: 'Depth', joint_state: 'Joints', ee_pose: 'EE Pose',
}

function priceLabel(p: CatalogProduct): string {
  return p.tier === 'free' ? '무료' : `$${p.price_usd.toLocaleString()}`
}

interface CardProps {
  p: CatalogProduct
  downloadKey: string
  owned: boolean
  onBuy: (p: CatalogProduct) => void
  onGenerate: (p: CatalogProduct) => void
  buying: boolean
}

function ProductCard({ p, downloadKey, owned, onBuy, onGenerate, buying }: CardProps) {
  const [imgOk, setImgOk] = useState(true)
  const paid = p.tier === 'paid'
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden flex flex-col hover:border-slate-600 transition-colors">
      {/* Preview */}
      <div className="relative h-32 bg-[#0d1117] flex items-center justify-center overflow-hidden">
        {p.has_preview && imgOk ? (
          <img
            src={api.datasetFrameUrl(p.id, 0)}
            alt={`${p.robot_name} preview`}
            className="h-full w-full object-cover"
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className="text-4xl opacity-60">{CATEGORY_ICON[p.category] ?? '🤖'}</span>
        )}
        <span className={clsx(
          'absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-full',
          paid ? 'bg-nvidia text-black' : 'bg-emerald-500 text-black'
        )}>
          {priceLabel(p)}
        </span>
        {paid && owned && (
          <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-black">
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
          {p.variant ? (
            <span className="text-[9px] font-bold text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded flex-shrink-0">
              ⚙ 변형
            </span>
          ) : (
            <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded flex-shrink-0">
              v{p.version}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px] mt-0.5">
          <div className="bg-[#0d1117] rounded px-2 py-1">
            <span className="text-slate-500">에피소드</span>
            <p className="font-bold text-slate-200">{p.episodes.toLocaleString()}</p>
          </div>
          <div className="bg-[#0d1117] rounded px-2 py-1">
            <span className="text-slate-500">용량</span>
            <p className="font-bold text-slate-200">{formatBytes(p.size_bytes)}</p>
          </div>
        </div>

        {/* Sensors */}
        <div className="flex flex-wrap gap-1">
          {p.sensors.map(s => (
            <span key={s} className="text-[9px] font-bold text-sky-300 bg-sky-950 px-1.5 py-0.5 rounded">
              {SENSOR_LABEL[s] ?? s}
            </span>
          ))}
        </div>

        {/* License */}
        <p className="text-[10px] text-slate-500 mt-auto pt-1">
          📄 {p.license}
        </p>

        {/* Action */}
        {!paid ? (
          <a
            href={api.catalogDownloadUrl(p.id)}
            className="text-center text-xs font-bold py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            무료 다운로드 ↓
          </a>
        ) : owned ? (
          <a
            href={api.catalogDownloadUrl(p.id, downloadKey)}
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

        {/* Order a randomized variant (Phase 3) */}
        {!p.variant && (
          <button
            onClick={() => onGenerate(p)}
            className="text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 transition-colors text-center"
          >
            ⚙ 조건 지정 변형 생성
          </button>
        )}
      </div>
    </div>
  )
}

const FILTERS = ['all', 'free', 'paid'] as const
type Filter = typeof FILTERS[number]

export function Datasets() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { notifyPurchase } = usePurchase()
  const { data: products = [], isLoading } = useCatalog()
  const [filter, setFilter] = useState<Filter>('all')

  // License key (DaaS Phase 1) — gates paid downloads. Persisted to localStorage.
  const [keyInput, setKeyInput] = useState(getLicenseKey())
  const [licenseKey, setKey] = useState(getLicenseKey())
  const { data: ents } = useEntitlements(licenseKey)

  // Account-linked library (by email) — when logged in, the buyer's purchases are
  // known without typing a key, so we auto-fill it + reflect ownership instantly.
  const { data: library } = useLibrary(!!user)

  // Checkout (DaaS Phase 2) — product whose mock-pay dialog is open + busy state.
  const [checkoutFor, setCheckoutFor] = useState<CatalogProduct | null>(null)
  const [pendingSession, setPendingSession] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Variant generation (DaaS Phase 3) — product being customized + the spec.
  const [genFor, setGenFor] = useState<CatalogProduct | null>(null)
  const [spec, setSpec] = useState<GenerateSpec>({ lighting: true, texture: false, physics: false, strength: 0.3, episodes: 10 })
  const [generating, setGenerating] = useState(false)

  // product_id → the license key that unlocks it (from the account library), so a
  // download always uses the right key even when purchases span multiple keys.
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

  // On login, auto-fill the license key box from the account's most recent key
  // (library is sorted newest-first) — only when the user hasn't typed one.
  useEffect(() => {
    const items = library?.items ?? []
    if (items.length && !licenseKey) {
      const k = items[0].license_key
      setLicenseKey(k)
      setKey(k)
      setKeyInput(k)
    }
  }, [library, licenseKey])

  // On logout (logged-in → null), clear the account-filled key from the box so it
  // doesn't carry over to whoever uses the device next. Only fires on the actual
  // transition, so a key pasted while logged out still persists across reloads.
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

  // Open checkout. Stripe → redirect to hosted page; mock → local confirm dialog.
  const handleCheckout = async (p: CatalogProduct) => {
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
      notifyPurchase({ name: checkoutFor?.robot_name || checkoutFor?.id || '데이터셋', key: res.license_key })
      closeCheckout()
    } finally {
      setBusyId(null)
    }
  }

  const openGenerate = (p: CatalogProduct) => {
    setSpec({ lighting: true, texture: false, physics: false, strength: 0.3, episodes: 10 })
    setGenFor(p)
  }

  const knobCount = Number(spec.lighting) + Number(spec.texture) + Number(spec.physics)
  const estPrice = genFor ? genFor.price_usd + 50 * knobCount : 0

  const confirmGenerate = async () => {
    if (!genFor || knobCount === 0) return
    setGenerating(true)
    try {
      await api.generateVariant(genFor.id, spec)
      qc.invalidateQueries({ queryKey: ['catalog'] })
      setGenFor(null)
    } finally {
      setGenerating(false)
    }
  }

  const displayed = useMemo(
    () => (filter === 'all' ? products : products.filter(p => p.tier === filter)),
    [products, filter],
  )
  const totalEpisodes = products.reduce((s, p) => s + p.episodes, 0)
  const paidCount = products.filter(p => p.tier === 'paid').length

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-200">Datasets — 합성 데이터 카탈로그</h2>
          <p className="text-xs text-muted mt-0.5">
            {products.length}개 상품 · {totalEpisodes.toLocaleString()} 에피소드 · 유료 {paidCount}종
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

      {/* License key bar (Phase 1 entitlements) */}
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
          <p className="text-slate-500 text-sm mb-1">📭 데이터셋 없음</p>
          <p className="text-slate-600 text-xs">EXPORT 스테이지를 실행하면 상품이 생성됩니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map(p => (
            <ProductCard
              key={p.id}
              p={p}
              downloadKey={ownedKeyMap.get(p.id) ?? licenseKey}
              owned={owned.has(p.id)}
              onBuy={handleCheckout}
              onGenerate={openGenerate}
              buying={busyId === p.id}
            />
          ))}
        </div>
      )}

      {/* Checkout dialog (mock payment — Phase 2) */}
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
                <p className="text-[11px] text-muted">{checkoutFor.category} · {checkoutFor.task}</p>
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

      {/* Variant generation dialog (Phase 3) */}
      {genFor && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !generating && setGenFor(null)}
        >
          <div
            className="bg-panel border border-border rounded-xl p-5 w-full max-w-sm flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">⚙ 조건 지정 데이터 생성</h3>
              <button onClick={() => !generating && setGenFor(null)} className="text-slate-400 hover:text-slate-200 text-lg leading-none">✕</button>
            </div>
            <p className="text-[11px] text-muted">
              <span className="font-bold text-slate-200">{genFor.robot_name}</span> 기반으로 도메인 랜덤화 조건을 적용한 변형 데이터셋을 생성합니다.
            </p>

            {/* Randomization knobs */}
            <div className="flex flex-col gap-1.5">
              {([['lighting', '조명 (Lighting)'], ['texture', '질감 (Texture)'], ['physics', '물리 (Physics)']] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spec[k]}
                    onChange={e => setSpec(s => ({ ...s, [k]: e.target.checked }))}
                    className="accent-indigo-500"
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* Strength */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>강도 (Strength)</span>
                <span className="font-mono text-slate-200">{spec.strength.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.05}
                value={spec.strength}
                onChange={e => setSpec(s => ({ ...s, strength: Number(e.target.value) }))}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Episodes */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">에피소드</span>
              <input
                type="number" min={1} max={50}
                value={spec.episodes}
                onChange={e => setSpec(s => ({ ...s, episodes: Math.max(1, Math.min(50, Number(e.target.value) || 1)) }))}
                className="w-20 bg-[#0d1117] border border-border rounded px-2 py-1 text-xs text-slate-200 text-right focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] bg-[#0d1117] rounded px-2.5 py-1.5">
              <span className="text-slate-400">예상 가격 (기본 ${genFor.price_usd} + 옵션 {knobCount}×$50)</span>
              <span className="font-black text-nvidia">${estPrice.toLocaleString()}</span>
            </div>

            <button
              onClick={confirmGenerate}
              disabled={generating || knobCount === 0}
              className="w-full text-sm font-bold py-2.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? '생성 중…' : knobCount === 0 ? '옵션을 1개 이상 선택' : '변형 생성'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
