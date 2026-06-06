import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { api } from '../api/client'
import type {
  Sale, ProductRank, TrendPoint, MemberRank, MemberSignup, BusinessSummary,
  MemberDetail, MemberItem, SignupPoint, Revocation,
} from '../api/client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useBusinessSummary } from '../hooks/usePipeline'

const TOKEN_KEY = 'odin_admin_token'

function usd(n?: number) {
  return '$' + (n ?? 0).toLocaleString()
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

const KIND_BADGE: Record<string, string> = {
  dataset: 'text-nvidia bg-nvidia/10',
  policy: 'text-fuchsia-300 bg-fuchsia-950',
  unknown: 'text-slate-400 bg-slate-800',
}
const KIND_LABEL: Record<string, string> = { dataset: '데이터셋', policy: '정책', unknown: '기타' }
const SOURCE_LABEL: Record<string, string> = { stripe: 'Stripe', mock: 'Mock' }

/** Shared empty-state for the sales-derived panels (trend / ranking / ledger). */
function NoSales({ pad = 'py-8' }: { pad?: string }) {
  return <p className={clsx('text-slate-600 text-xs text-center', pad)}>아직 판매 내역이 없습니다</p>
}

/** Passcode gate — revenue is confidential, so the admin page is locked. */
function AdminGate({ onUnlock, onCancel }: { onUnlock: (token: string) => void; onCancel?: () => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!pw.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await api.adminLogin(pw.trim())
      localStorage.setItem(TOKEN_KEY, pw.trim())
      onUnlock(pw.trim())
    } catch {
      setErr('잘못된 관리자 패스코드입니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-5 flex justify-center">
      <div className="mt-16 w-full max-w-sm bg-panel border border-border rounded-xl p-6 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-3xl">🔒</span>
          <h2 className="text-sm font-bold text-slate-200">관리자 인증</h2>
          <p className="text-xs text-muted">매출·구독 등 기업 기밀 지표는 관리자만 열람할 수 있습니다.</p>
        </div>
        <input
          type="password"
          value={pw}
          autoFocus
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="관리자 패스코드"
          className="bg-[#0d1117] border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-400"
        />
        {err && <p className="text-[11px] text-rose-400">{err}</p>}
        <button
          onClick={submit}
          disabled={busy || !pw.trim()}
          className="text-xs font-bold py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? '확인 중…' : '잠금 해제'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← 스토어로 돌아가기
          </button>
        )}
      </div>
    </div>
  )
}

function BizModelCard({ tag, tagColor, title, subtitle, rows, footer }: {
  tag: string; tagColor: string; title: string; subtitle: string
  rows: { label: string; value: string | number; accent?: string }[]
  footer?: ReactNode
}) {
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ borderColor: tagColor + '33', background: 'linear-gradient(160deg,#0d1018 0%,#111620 100%)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-slate-100">{title}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ color: tagColor, background: tagColor + '1a' }}>{tag}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{r.label}</span>
            <span className={clsx('font-mono font-bold', r.accent ?? 'text-slate-200')}>{r.value}</span>
          </div>
        ))}
      </div>
      {footer}
    </div>
  )
}

function AdminDashboard({ token, onLock }: { token: string; onLock: () => void }) {
  // All hooks must run unconditionally and in a stable order — keep them above
  // any early return (Rules of Hooks), otherwise an isError-triggered return
  // would skip useState and crash with a hook-count mismatch.
  const { data: biz, isLoading, isError } = useBusinessSummary(token)
  const [exporting, setExporting] = useState(false)
  const [exportingMembers, setExportingMembers] = useState(false)
  const [memberEmail, setMemberEmail] = useState<string | null>(null)

  // An expired/invalid token (e.g. backend ADMIN_TOKEN changed) → force re-auth.
  if (isError) {
    localStorage.removeItem(TOKEN_KEY)
    return <AdminGate onUnlock={() => window.location.reload()} />
  }

  const util = biz?.mlops.utilization ?? 0
  const barColor = util > 0.9 ? 'bg-rose-500' : util > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'

  const downloadBlob = (blob: Blob, prefix: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      downloadBlob(await api.getSalesCsv(token), 'odin-sales')
    } finally {
      setExporting(false)
    }
  }

  const handleExportMembers = async () => {
    setExportingMembers(true)
    try {
      downloadBlob(await api.getMembersCsv(token), 'odin-members')
    } finally {
      setExportingMembers(false)
    }
  }

  const KPIS = biz ? [
    { label: '실현 매출', value: usd(biz.revenue.realized_usd), sub: `${biz.revenue.orders}건 주문`, color: 'text-emerald-400' },
    { label: '구독 MRR', value: usd(biz.revenue.mrr_usd), sub: biz.mlops.plan_name ?? '—', color: 'text-indigo-300' },
    { label: '카탈로그 가치', value: usd(biz.revenue.catalog_value_usd), sub: '판매 가능 재고', color: 'text-nvidia' },
    { label: '총 상품', value: biz.datasets.total + biz.policies.total, sub: `데이터 ${biz.datasets.total} · 정책 ${biz.policies.total}`, color: 'text-slate-100' },
  ] : []

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-200">🔐 관리자 — 비즈니스 메트릭</h2>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900">CONFIDENTIAL</span>
          </div>
          <p className="text-xs text-muted mt-0.5">ODIN 3대 모델 매출·재고·사용량 통합 현황 (관리자 전용)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || !biz || biz.revenue.orders === 0}
            className="text-[11px] font-bold px-3 py-1.5 rounded-md bg-nvidia/10 text-nvidia border border-nvidia/30 hover:bg-nvidia/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? '내보내는 중…' : '⬇ 판매 CSV'}
          </button>
          <button
            onClick={handleExportMembers}
            disabled={exportingMembers || !biz || biz.members.total === 0}
            className="text-[11px] font-bold px-3 py-1.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {exportingMembers ? '내보내는 중…' : '⬇ 회원 CSV'}
          </button>
          <button
            onClick={onLock}
            title="관리자 세션을 종료하고 스토어로 돌아갑니다"
            className="text-[11px] font-bold px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            🔒 로그아웃
          </button>
        </div>
      </div>

      {isLoading || !biz ? (
        <p className="text-slate-600 text-xs py-12 text-center">불러오는 중…</p>
      ) : (
        <>
          {/* Top revenue KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {KPIS.map(k => (
              <div key={k.label} className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{k.label}</p>
                <p className={clsx('text-2xl font-black font-mono', k.color)}>{k.value}</p>
                <p className="text-[11px] text-slate-500">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Per-model cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <BizModelCard
              tag="#1 DaaS" tagColor="#76b900"
              title="합성 데이터셋" subtitle="Data-as-a-Service"
              rows={[
                { label: '총 데이터셋', value: biz.datasets.total },
                { label: '유료', value: biz.datasets.paid },
                { label: '카탈로그 가치', value: usd(biz.datasets.value_usd), accent: 'text-nvidia' },
              ]}
            />
            <BizModelCard
              tag="#2 MLOps" tagColor="#6366f1"
              title="MLOps SaaS" subtitle="실험 추적 · 레지스트리 · 사용량 과금"
              rows={[
                { label: '실험', value: biz.mlops.experiments },
                { label: '등록 모델', value: biz.mlops.registered_models, accent: 'text-indigo-300' },
                { label: `GPU (${biz.mlops.plan_name ?? '—'})`, value: `${biz.mlops.gpu_minutes_used.toLocaleString()} / ${biz.mlops.gpu_minutes_quota.toLocaleString()}` },
              ]}
              footer={
                <div className="h-1.5 bg-[#0d1117] rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full', barColor)} style={{ width: `${Math.min(100, util * 100)}%` }} />
                </div>
              }
            />
            <BizModelCard
              tag="#3 Marketplace" tagColor="#d946ef"
              title="정책 마켓플레이스" subtitle="Skill/Policy Marketplace"
              rows={[
                { label: '총 정책', value: biz.policies.total },
                { label: '유료', value: biz.policies.paid },
                { label: '카탈로그 가치', value: usd(biz.policies.value_usd), accent: 'text-fuchsia-300' },
              ]}
            />
          </div>

          {/* Realized revenue split by model */}
          <RevenueSplit
            datasets={biz.revenue.by_model.datasets_usd}
            policies={biz.revenue.by_model.policies_usd}
          />

          {/* Sales trend over time */}
          <RevenueTrend trend={biz.revenue_trend} />

          {/* Best-selling products ranking */}
          <ProductRanking products={biz.top_products} />

          {/* Recent sales ledger */}
          <SalesTable sales={biz.recent_sales} />

          {/* Member analytics — signups, paying customers, spend ranking */}
          <MembersPanel members={biz.members} onSelect={setMemberEmail} />

          {/* Revocation audit trail — recently revoked licenses with reasons */}
          <RevocationHistory revocations={biz.recent_revocations} />
        </>
      )}

      {memberEmail && (
        <MemberDetailModal token={token} email={memberEmail} onClose={() => setMemberEmail(null)} />
      )}
    </div>
  )
}

function RevenueSplit({ datasets, policies }: { datasets: number; policies: number }) {
  const total = datasets + policies
  const dsPct = total ? (datasets / total) * 100 : 0
  const polPct = total ? (policies / total) * 100 : 0
  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-300">실현 매출 구성 (모델별)</p>
        <span className="text-[11px] font-mono font-bold text-slate-200">{usd(total)}</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex bg-[#0d1117]">
        <div className="h-full bg-nvidia" style={{ width: `${dsPct}%` }} title={`데이터셋 ${usd(datasets)}`} />
        <div className="h-full bg-fuchsia-500" style={{ width: `${polPct}%` }} title={`정책 ${usd(policies)}`} />
      </div>
      <div className="flex items-center gap-4 text-[10px]">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-nvidia" /><span className="text-slate-400">#1 데이터셋</span> <span className="font-mono text-nvidia font-bold">{usd(datasets)}</span> <span className="text-slate-600">({dsPct.toFixed(0)}%)</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-fuchsia-500" /><span className="text-slate-400">#3 정책</span> <span className="font-mono text-fuchsia-300 font-bold">{usd(policies)}</span> <span className="text-slate-600">({polPct.toFixed(0)}%)</span></span>
      </div>
    </div>
  )
}

function RevenueTrend({ trend }: { trend: TrendPoint[] }) {
  const data = trend.map(t => ({ ...t, label: t.date.slice(5) }))  // MM-DD
  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-slate-300">📈 매출 추세</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-nvidia" /><span className="text-slate-400">일별 매출</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-fuchsia-400" /><span className="text-slate-400">누적 매출</span></span>
        </div>
      </div>
      <div className="h-44">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center"><NoSales pad="" /></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
              <XAxis dataKey="label" stroke="#475569" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" stroke="#475569" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#475569" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3148', fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number, name: string) => {
                  const labels: Record<string, string> = { revenue_usd: '일별 매출', cumulative_usd: '누적 매출', orders: '주문' }
                  return [name === 'orders' ? `${v}건` : usd(v), labels[name] ?? name]
                }}
              />
              <Bar yAxisId="left" dataKey="revenue_usd" fill="#76b900" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey="cumulative_usd" stroke="#e879f9" dot={false} strokeWidth={2} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function SignupTrend({ trend }: { trend: SignupPoint[] }) {
  const data = trend.map(t => ({ ...t, label: t.date.slice(5) }))  // MM-DD
  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-slate-300">📈 가입 추세</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sky-500" /><span className="text-slate-400">일별 가입</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-indigo-400" /><span className="text-slate-400">누적 회원</span></span>
        </div>
      </div>
      <div className="h-44">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-600 text-xs text-center">아직 가입 내역이 없습니다</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
              <XAxis dataKey="label" stroke="#475569" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" stroke="#475569" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#475569" tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3148', fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number, name: string) => {
                  const labels: Record<string, string> = { signups: '일별 가입', cumulative: '누적 회원' }
                  return [`${v}명`, labels[name] ?? name]
                }}
              />
              <Bar yAxisId="left" dataKey="signups" fill="#0ea5e9" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#818cf8" dot={false} strokeWidth={2} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function ProductRanking({ products }: { products: ProductRank[] }) {
  const max = products.reduce((m, p) => Math.max(m, p.revenue_usd), 0)
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-slate-300">🏆 상품별 매출 랭킹 ({products.length})</h3>
        <span className="text-[10px] text-slate-500">매출순 · 상위 8개</span>
      </div>
      {products.length === 0 ? (
        <NoSales />
      ) : (
        <div className="flex flex-col">
          {products.map((p, i) => {
            const pct = max ? (p.revenue_usd / max) * 100 : 0
            return (
              <div key={p.product_id} className="px-4 py-2.5 border-b border-border/50 hover:bg-[#0d1117]/50 flex items-center gap-3">
                <span className="text-[11px] font-black text-slate-600 w-5 text-right tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={clsx('text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0', KIND_BADGE[p.kind])}>{KIND_LABEL[p.kind]}</span>
                    <p className="font-semibold text-slate-200 text-xs truncate">{p.name}</p>
                  </div>
                  <div className="mt-1 h-1.5 bg-[#0d1117] rounded-full overflow-hidden">
                    <div className={clsx('h-full rounded-full', p.kind === 'policy' ? 'bg-fuchsia-500' : 'bg-nvidia')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono font-bold text-emerald-300 text-xs">{usd(p.revenue_usd)}</p>
                  <p className="text-[10px] text-slate-500">{p.units}건</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SalesTable({ sales }: { sales: Sale[] }) {
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-slate-300">🧾 최근 판매 내역 ({sales.length})</h3>
        <span className="text-[10px] text-slate-500">최신순 · 최대 12건</span>
      </div>
      {sales.length === 0 ? (
        <NoSales />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 border-b border-border">
                <th className="text-left font-semibold px-4 py-2">상품</th>
                <th className="text-left font-semibold px-2 py-2">종류</th>
                <th className="text-right font-semibold px-2 py-2">금액</th>
                <th className="text-center font-semibold px-2 py-2">결제</th>
                <th className="text-left font-semibold px-2 py-2">구매자</th>
                <th className="text-right font-semibold px-4 py-2">일시</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s, i) => (
                <tr key={`${s.product_id}-${i}`} className="border-b border-border/50 hover:bg-[#0d1117]/50">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-slate-200">{s.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{s.product_id}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={clsx('text-[9px] font-black px-1.5 py-0.5 rounded', KIND_BADGE[s.kind])}>{KIND_LABEL[s.kind]}</span>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono font-bold text-emerald-300">{usd(s.price_usd)}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400">{SOURCE_LABEL[s.source] ?? s.source}</td>
                  <td className="px-2 py-2.5 text-slate-400">{s.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 font-mono">{fmtDate(s.granted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Audit trail — recently revoked licenses with the reason captured at revoke time. */
function RevocationHistory({ revocations }: { revocations: Revocation[] }) {
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-slate-300">🚫 폐기 이력 ({revocations.length})</h3>
        <span className="text-[10px] text-slate-500">최신순 · 최대 12건</span>
      </div>
      {revocations.length === 0 ? (
        <p className="px-4 py-6 text-center text-[11px] text-slate-500">폐기된 라이선스가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 border-b border-border">
                <th className="text-left font-semibold px-4 py-2">상품</th>
                <th className="text-left font-semibold px-2 py-2">종류</th>
                <th className="text-left font-semibold px-2 py-2">구매자</th>
                <th className="text-left font-semibold px-2 py-2 hidden md:table-cell">라이선스 키</th>
                <th className="text-left font-semibold px-2 py-2">사유</th>
                <th className="text-right font-semibold px-4 py-2">폐기 일시</th>
              </tr>
            </thead>
            <tbody>
              {revocations.map((r: Revocation, i: number) => (
                <tr key={`${r.license_key}-${r.product_id}-${i}`} className="border-b border-border/50 hover:bg-[#0d1117]/50">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-slate-200">{r.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{r.product_id}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={clsx('text-[9px] font-black px-1.5 py-0.5 rounded', KIND_BADGE[r.kind])}>{KIND_LABEL[r.kind]}</span>
                  </td>
                  <td className="px-2 py-2.5 text-slate-400">{r.email ?? '—'}</td>
                  <td className="px-2 py-2.5 font-mono text-[10px] text-slate-500 hidden md:table-cell">{r.license_key}</td>
                  <td className="px-2 py-2.5 text-slate-300">{r.reason || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 font-mono">{fmtDate(r.revoked_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function initialOf(m: { name: string | null; email: string }) {
  return (m.name || m.email).charAt(0).toUpperCase()
}

/** Member analytics — total/paying counts, a spend ranking, and recent signups. */
function MembersPanel({ members, onSelect }: {
  members: BusinessSummary['members']
  onSelect: (email: string) => void
}) {
  const { total, paying, top, recent_signups } = members
  const conversion = total ? (paying / total) * 100 : 0
  const maxRev = top.reduce((m, x) => Math.max(m, x.revenue_usd), 0)
  const [query, setQuery] = useState('')

  // Known emails (ranking + signups) power a quick datalist for the search box.
  const knownEmails = Array.from(new Set([
    ...top.map(m => m.email),
    ...recent_signups.map(m => m.email),
  ]))

  const submitSearch = () => {
    const q = query.trim()
    if (q) onSelect(q)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Member search */}
      <div className="bg-panel border border-border rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-slate-400">🔍 회원 조회</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitSearch() }}
          list="member-emails"
          placeholder="이메일로 회원 검색 (예: buyer@odin.io)"
          className="flex-1 min-w-[200px] bg-[#0d1117] border border-border rounded px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-400"
        />
        <datalist id="member-emails">
          {knownEmails.map(e => <option key={e} value={e} />)}
        </datalist>
        <button
          onClick={submitSearch}
          disabled={!query.trim()}
          className="text-[11px] font-bold px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          조회
        </button>
      </div>

      {/* Member KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '총 회원', value: total.toLocaleString(), sub: '가입 계정', color: 'text-sky-300' },
          { label: '구매 회원', value: paying.toLocaleString(), sub: '결제 이력 보유', color: 'text-emerald-400' },
          { label: '구매 전환율', value: `${conversion.toFixed(0)}%`, sub: '구매 / 전체', color: 'text-indigo-300' },
        ].map(k => (
          <div key={k.label} className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{k.label}</p>
            <p className={clsx('text-2xl font-black font-mono', k.color)}>{k.value}</p>
            <p className="text-[11px] text-slate-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Daily signup growth */}
      <SignupTrend trend={members.signup_trend} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top members by spend */}
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-slate-300">👑 우수 회원 ({top.length})</h3>
            <span className="text-[10px] text-slate-500">지출순 · 상위 8명</span>
          </div>
          {top.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-8">아직 구매한 회원이 없습니다</p>
          ) : (
            <div className="flex flex-col">
              {top.map((m: MemberRank, i: number) => {
                const pct = maxRev ? (m.revenue_usd / maxRev) * 100 : 0
                return (
                  <button
                    key={m.email}
                    onClick={() => onSelect(m.email)}
                    title="회원 상세 보기"
                    className="w-full text-left px-4 py-2.5 border-b border-border/50 hover:bg-[#0d1117]/50 flex items-center gap-3 transition-colors"
                  >
                    <span className="text-[11px] font-black text-slate-600 w-4 text-right tabular-nums">{i + 1}</span>
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black flex-shrink-0">
                      {initialOf(m)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-slate-200 text-xs truncate">{m.name || m.email.split('@')[0]}</p>
                        {!m.registered && (
                          <span className="text-[8px] font-black px-1 py-0.5 rounded bg-slate-800 text-slate-500 flex-shrink-0" title="계정 미등록(키 전용 구매)">비회원</span>
                        )}
                      </div>
                      <div className="mt-1 h-1.5 bg-[#0d1117] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold text-emerald-300 text-xs">{usd(m.revenue_usd)}</p>
                      <p className="text-[10px] text-slate-500">{m.units}건</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent signups */}
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-slate-300">🆕 최근 가입 ({recent_signups.length})</h3>
            <span className="text-[10px] text-slate-500">최신순 · 최대 6명</span>
          </div>
          {recent_signups.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-8">가입한 회원이 없습니다</p>
          ) : (
            <div className="flex flex-col">
              {recent_signups.map((m: MemberSignup) => (
                <button
                  key={m.email}
                  onClick={() => onSelect(m.email)}
                  title="회원 상세 보기"
                  className="w-full text-left px-4 py-2.5 border-b border-border/50 hover:bg-[#0d1117]/50 flex items-center gap-3 transition-colors"
                >
                  <span className="w-7 h-7 rounded-full bg-sky-700 text-white flex items-center justify-center text-[11px] font-black flex-shrink-0">
                    {initialOf(m)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 text-xs truncate">{m.name || m.email.split('@')[0]}</p>
                    <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">{fmtDate(m.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Admin drill-down for one customer: account + every owned product (license
 *  keys, paid/grant source, dates) with spend totals. Opened from search or a
 *  member row. Source 'mock'/'stripe' = a paid order; anything else = dev grant. */
function MemberDetailModal({ token, email, onClose }: {
  token: string; email: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [data, setData] = useState<MemberDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      setData(await api.getMember(token, email))
    } catch {
      setErr('회원 정보를 불러오지 못했습니다.')
    }
  }, [token, email])

  useEffect(() => {
    setData(null)
    load()
  }, [load])

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(c => (c === key ? null : c)), 1500)
    } catch { /* clipboard blocked — ignore */ }
  }

  const revoke = async (it: MemberItem) => {
    const reason = window.prompt(
      `'${it.name}' 라이선스(${it.license_key})를 폐기합니다.\n구매자는 더 이상 다운로드할 수 없습니다.\n\n폐기 사유를 입력하세요 (선택, 감사 기록에 남습니다):`,
    )
    if (reason === null) return  // 취소
    setRevoking(it.license_key + it.product_id)
    try {
      await api.revokeEntitlement(token, it.license_key, it.product_id, reason.trim() || undefined)
      await load()
      // Totals/ranking on the admin page derive from the same ledger — refresh them.
      qc.invalidateQueries({ queryKey: ['business-summary'] })
    } catch {
      setErr('폐기에 실패했습니다.')
    } finally {
      setRevoking(null)
    }
  }

  const fmtFull = (ts: number) =>
    new Date(ts * 1000).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="mt-12 w-full max-w-3xl bg-panel border border-border rounded-xl p-6 flex flex-col gap-4 max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0">
              {(data?.name || email).charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-200 truncate">{data?.name || email.split('@')[0]}</h2>
                {data && (
                  data.registered
                    ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 flex-shrink-0">회원</span>
                    : <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 flex-shrink-0" title="계정 미등록(키 전용 구매)">비회원</span>
                )}
              </div>
              <p className="text-[11px] text-muted truncate">{email}</p>
              {data?.created_at && (
                <p className="text-[10px] text-slate-500">가입 {fmtFull(data.created_at)}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        {err && <p className="text-[11px] text-rose-400">{err}</p>}

        {!data && !err && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map(i => <div key={i} className="h-10 rounded bg-border/40 animate-pulse" />)}
          </div>
        )}

        {data && (
          <>
            {/* Stat chips */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '보유 상품', value: data.owned.toLocaleString(), color: 'text-slate-100' },
                { label: '구매(결제)', value: `${data.orders.toLocaleString()}건`, color: 'text-indigo-300' },
                { label: '총 지출', value: usd(data.spent_usd), color: 'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="bg-[#0d1117] rounded-lg p-3 flex flex-col gap-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{s.label}</p>
                  <p className={clsx('text-lg font-black font-mono', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Owned products / license keys */}
            {data.items.length === 0 ? (
              <p className="text-xs text-muted text-center py-10">보유한 상품이 없습니다.</p>
            ) : (
              <div className="overflow-y-auto -mx-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-500 border-b border-border">
                      <th className="font-bold px-2 py-2">상품</th>
                      <th className="font-bold px-2 py-2 hidden sm:table-cell">종류</th>
                      <th className="font-bold px-2 py-2">출처</th>
                      <th className="font-bold px-2 py-2 text-right">금액</th>
                      <th className="font-bold px-2 py-2 hidden md:table-cell">라이선스 키</th>
                      <th className="font-bold px-2 py-2 text-right hidden sm:table-cell">일시</th>
                      <th className="font-bold px-2 py-2 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it: MemberItem, i: number) => (
                      <tr key={`${it.license_key}-${it.product_id}-${i}`} className="border-b border-border/50 hover:bg-border/20">
                        <td className="px-2 py-2 text-xs text-slate-200">
                          {it.name}
                          <span className="block sm:hidden text-[10px] text-slate-500">{KIND_LABEL[it.kind]}</span>
                        </td>
                        <td className="px-2 py-2 hidden sm:table-cell">
                          <span className={clsx('text-[9px] font-black px-1.5 py-0.5 rounded', KIND_BADGE[it.kind])}>{KIND_LABEL[it.kind]}</span>
                        </td>
                        <td className="px-2 py-2">
                          {it.paid
                            ? <span className="text-[10px] text-emerald-400 font-semibold">{SOURCE_LABEL[it.source] ?? it.source}</span>
                            : <span className="text-[10px] text-slate-500" title="관리자/개발 무상 발급">무상</span>}
                        </td>
                        <td className="px-2 py-2 text-xs font-bold text-right whitespace-nowrap">
                          {it.paid
                            ? <span className="text-emerald-400">{usd(it.price_usd)}</span>
                            : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-2 py-2 hidden md:table-cell">
                          <button
                            onClick={() => copyKey(it.license_key)}
                            title="클릭하여 복사"
                            className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {copiedKey === it.license_key ? '✓ 복사됨' : it.license_key}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-[10px] text-slate-500 text-right hidden sm:table-cell whitespace-nowrap">{fmtDate(it.granted_at)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => revoke(it)}
                            disabled={revoking === it.license_key + it.product_id}
                            title="이 라이선스를 폐기"
                            className="text-[10px] font-bold px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-900 hover:bg-rose-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {revoking === it.license_key + it.product_id ? '…' : '폐기'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function Admin({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? '')

  // 로그아웃: 세션 토큰을 지우고 곧장 스토어(홈)로 빠져나간다.
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    onExit()
  }

  if (!token) return <AdminGate onUnlock={setToken} onCancel={onExit} />
  return <AdminDashboard token={token} onLock={logout} />
}
