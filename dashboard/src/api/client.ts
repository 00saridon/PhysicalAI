import type { Artifact, PipelineStatus, StageId } from '../types/pipeline'
import { getApiBase, getAuthToken } from './base'

/** Authorization header for the logged-in customer (empty when logged out). */
function authHeader(): Record<string, string> {
  const t = getAuthToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function _fetch<T>(path: string, init?: RequestInit): Promise<T> {
  // `ngrok-skip-browser-warning` bypasses ngrok-free's interstitial HTML page
  // when the backend is an ngrok tunnel (Colab GPU). Harmless for other hosts.
  // (SSE/EventSource can't set headers, but bypasses via its text/event-stream Accept.)
  const res = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: { 'ngrok-skip-browser-warning': 'true', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json() as Promise<T>
}

export interface DemoFile {
  name: string
  path: string
  size_bytes: number
  created_at: number
}

export type ConfigMap = Record<string, unknown>

export interface GpuStat {
  name: string
  util: number | null
  mem_used: number | null
  mem_total: number | null
  temp: number | null
  power: number | null
  power_max: number | null
}

export interface SystemInfo {
  mode: { mock: boolean; real_available: boolean }
  pipeline: { running: boolean; stage: string | null }
  gpu: { available: boolean; gpus?: GpuStat[] }
  host: { platform: string; python: string; cpu_count: number | null }
}

export interface CatalogProduct {
  id: string
  robot: string
  robot_name: string
  category: string
  task: string
  version: string
  episodes: number
  frames: number
  sensors: string[]
  joint_dim: number
  action_dim: number
  randomization: { lighting: boolean; texture: boolean; physics: boolean }
  license: string
  tier: 'free' | 'paid'
  price_usd: number
  size_bytes: number
  checksum_sha256: string | null
  created_at: number
  has_preview: boolean
  derived?: boolean
  variant?: boolean
  parent_id?: string
  download_url?: string
  preview_url?: string
}

export interface Entitlement {
  license_key: string
  product_id: string
  email: string | null
  source: string
  seats: number
  granted_at: number
}

export interface OwnedProduct {
  product_id: string
  email: string | null
  source: string
  seats: number
  granted_at: number
}

export interface GenerateSpec {
  lighting: boolean
  texture: boolean
  physics: boolean
  strength: number
  episodes: number
}

export interface CheckoutSession {
  mode: 'stripe' | 'mock'
  session_id: string
  checkout_url: string | null
}

export interface PaymentResult {
  license_key: string
  product_id: string
  already: boolean
}

export interface PolicyMetrics {
  success_rate: number | null
  mean_reward: number | null
  episodes_trained: number | null
}

export interface PolicyProduct {
  id: string
  kind: 'policy'
  robot: string
  robot_name: string
  category: string
  task: string
  algo: string
  trained_on: string | null
  format: string
  obs_dim: number | null
  action_dim: number | null
  opset: number | null
  version: string
  metrics: PolicyMetrics
  license: string
  tier: 'free' | 'paid'
  price_usd: number
  size_bytes: number
  checksum_sha256: string | null
  created_at: number
  derived?: boolean
  download_url?: string
}

export interface CurvePoint {
  epoch: number
  success_rate: number
  loss: number
}

export interface Experiment {
  id: string
  name: string
  algo: string
  robot: string
  dataset: string | null
  hyperparams: Record<string, unknown>
  status: string
  success_rate: number | null
  mean_reward: number | null
  final_loss: number | null
  epochs: number | null
  gpu_seconds: number
  curve: CurvePoint[]
  registered_policy_id: string | null
  created_at: number
  completed_at: number | null
}

export interface RunSpec {
  name?: string
  algo: string
  robot: string
  dataset?: string | null
  hyperparams?: Record<string, unknown>
}

export interface Plan {
  name: string
  gpu_minutes: number
  price_usd: number
  concurrent: number
}

export interface UsageSummary {
  plan: string
  plan_name: string
  price_usd: number
  gpu_minutes_quota: number
  gpu_minutes_used: number
  gpu_minutes_remaining: number
  utilization: number
  experiments: number
  registered_models: number
  plans: Record<string, Plan>
}

export interface RegisterResult {
  policy_id: string
  already: boolean
  price_usd?: number
  download_url: string
}

export interface Sale {
  product_id: string
  name: string
  kind: 'dataset' | 'policy' | 'unknown'
  price_usd: number
  source: string
  email: string | null
  granted_at: number
}

export interface ProductRank {
  product_id: string
  name: string
  kind: 'dataset' | 'policy' | 'unknown'
  units: number
  revenue_usd: number
}

export interface TrendPoint {
  date: string
  revenue_usd: number
  orders: number
  cumulative_usd: number
}

export interface MemberRank {
  email: string
  name: string | null
  registered: boolean
  units: number
  revenue_usd: number
  last_order_at: number
}

export interface MemberSignup {
  email: string
  name: string | null
  created_at: number
}

export interface SignupPoint {
  date: string
  signups: number
  cumulative: number
}

export interface MemberItem {
  product_id: string
  name: string
  kind: 'dataset' | 'policy' | 'unknown'
  price_usd: number
  source: string
  paid: boolean
  license_key: string
  granted_at: number
}

export interface MemberDetail {
  email: string
  registered: boolean
  name: string | null
  created_at: number | null
  items: MemberItem[]
  owned: number
  orders: number
  spent_usd: number
}

export interface Revocation {
  product_id: string
  name: string
  kind: 'dataset' | 'policy' | 'unknown'
  email: string | null
  source: string
  reason: string | null
  license_key: string
  revoked_at: number
}

export interface BusinessSummary {
  revenue: {
    realized_usd: number
    orders: number
    mrr_usd: number
    catalog_value_usd: number
    by_model: { datasets_usd: number; policies_usd: number }
  }
  recent_sales: Sale[]
  recent_revocations: Revocation[]
  top_products: ProductRank[]
  revenue_trend: TrendPoint[]
  members: {
    total: number
    paying: number
    top: MemberRank[]
    recent_signups: MemberSignup[]
    signup_trend: SignupPoint[]
  }
  datasets: { total: number; paid: number; value_usd: number }
  policies: { total: number; paid: number; value_usd: number }
  mlops: {
    experiments: number
    registered_models: number
    plan: string | null
    plan_name: string | null
    gpu_minutes_used: number
    gpu_minutes_quota: number
    utilization: number
  }
}

export interface Trajectory {
  name: string
  n_total: number
  stride: number
  count: number
  joint_dim: number
  action_dim: number
  has_rgb: boolean
  joints: number[][]
  actions: number[][]
  rewards: number[]
}

export interface AuthUser {
  email: string
  name: string | null
  created_at: number
}

export interface AuthResult {
  token: string
  user: AuthUser
}

export interface LibraryItem {
  product_id: string
  name: string
  kind: 'dataset' | 'policy' | 'unknown'
  price_usd: number
  license_key: string
  source: string
  granted_at: number
}

export interface Library {
  email: string
  items: LibraryItem[]
}

export interface Order {
  product_id: string
  name: string
  kind: 'dataset' | 'policy' | 'unknown'
  price_usd: number
  license_key: string
  source: string
  granted_at: number
}

export interface Orders {
  email: string
  orders: Order[]
  count: number
  total_usd: number
}

export const api = {
  health: () => _fetch<{ status: string }>('/health'),
  getStatus: () => _fetch<PipelineStatus>('/status'),
  runStage: (stage: StageId, options?: { validate?: boolean }) => {
    const params = new URLSearchParams()
    if (options?.validate) params.set('validate', 'true')
    const qs = params.toString() ? `?${params}` : ''
    return _fetch<{ started: string }>(`/run/${stage}${qs}`, { method: 'POST' })
  },
  stopStage: () => _fetch<{ stopped: StageId | null }>('/stop', { method: 'POST' }),
  getSystem: () => _fetch<SystemInfo>('/system'),
  getMode: () => _fetch<{ mock: boolean; real_available: boolean }>('/mode'),
  setMode: (mock: boolean) =>
    _fetch<{ mock: boolean; real_available: boolean }>('/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mock }),
    }),
  getArtifacts: () => _fetch<Artifact[]>('/artifacts'),
  artifactDownloadUrl: (id: string) => `${getApiBase()}/artifacts/${id}/download`,
  getDemos: () => _fetch<DemoFile[]>('/demos'),
  getConfig: () => _fetch<ConfigMap>('/config'),
  getTrajectory: (name = 'synthetic_v1', frames = 240) =>
    _fetch<Trajectory>(`/dataset/trajectory?name=${encodeURIComponent(name)}&frames=${frames}`),
  getCatalog: () => _fetch<CatalogProduct[]>('/catalog'),
  getProduct: (id: string) => _fetch<CatalogProduct>(`/catalog/${encodeURIComponent(id)}`),
  // Parameterized synthetic generation (DaaS Phase 3) — order a randomized variant.
  generateVariant: (productId: string, spec: GenerateSpec) =>
    _fetch<CatalogProduct & { reused: boolean }>(`/catalog/${encodeURIComponent(productId)}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    }),
  catalogDownloadUrl: (id: string, key?: string) =>
    `${getApiBase()}/catalog/${encodeURIComponent(id)}/download` +
    (key ? `?key=${encodeURIComponent(key)}` : ''),
  // Entitlements (DaaS Phase 1) — issue/verify download licenses for paid products.
  grantEntitlement: (productId: string, email?: string, licenseKey?: string) =>
    _fetch<Entitlement>('/entitlements/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, email, source: 'manual', license_key: licenseKey }),
    }),
  listEntitlements: (key: string) =>
    _fetch<{ license_key: string; products: OwnedProduct[] }>(`/entitlements?key=${encodeURIComponent(key)}`),
  checkEntitlement: (productId: string, key: string) =>
    _fetch<{ product_id: string; owned: boolean }>(
      `/entitlements/check/${encodeURIComponent(productId)}?key=${encodeURIComponent(key)}`,
    ),
  // Billing (DaaS Phase 2) — checkout + fulfillment. Mock mode needs no Stripe keys.
  createCheckout: (productId: string, email?: string, licenseKey?: string) =>
    _fetch<CheckoutSession>('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        email,
        license_key: licenseKey,
        success_url: `${window.location.origin}/?paid=1`,
        cancel_url: window.location.href,
      }),
    }),
  mockPay: (sessionId: string) =>
    _fetch<PaymentResult>(`/billing/mock/${encodeURIComponent(sessionId)}/pay`, { method: 'POST' }),
  datasetFrameUrl: (name: string, idx = 0) =>
    `${getApiBase()}/dataset/frame?name=${encodeURIComponent(name)}&idx=${idx}`,
  // Skill/Policy Marketplace (Model #3) — trained policies sold as products.
  getPolicies: () => _fetch<PolicyProduct[]>('/policies'),
  getPolicy: (id: string) => _fetch<PolicyProduct>(`/policies/${encodeURIComponent(id)}`),
  policyDownloadUrl: (id: string, key?: string) =>
    `${getApiBase()}/policies/${encodeURIComponent(id)}/download` +
    (key ? `?key=${encodeURIComponent(key)}` : ''),
  // Robotics MLOps SaaS (Model #2) — experiment tracking, registry, usage.
  getExperiments: () => _fetch<Experiment[]>('/experiments'),
  getLeaderboard: (robot?: string, limit = 10) => {
    const params = new URLSearchParams()
    if (robot) params.set('robot', robot)
    params.set('limit', String(limit))
    return _fetch<Experiment[]>(`/experiments/leaderboard?${params}`)
  },
  getExperiment: (id: string) => _fetch<Experiment>(`/experiments/${encodeURIComponent(id)}`),
  submitExperiment: (spec: RunSpec) =>
    _fetch<Experiment>('/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(spec),
    }),
  registerModel: (expId: string) =>
    _fetch<RegisterResult>(`/experiments/${encodeURIComponent(expId)}/register`, {
      method: 'POST',
      headers: { ...authHeader() },
    }),
  deleteExperiment: (expId: string) =>
    _fetch<{ ok: boolean }>(`/experiments/${encodeURIComponent(expId)}`, {
      method: 'DELETE',
      headers: { ...authHeader() },
    }),
  getUsage: () => _fetch<UsageSummary>('/mlops/usage'),
  // Cross-model business rollup (admin-only — revenue is confidential).
  getBusinessSummary: (token: string) =>
    _fetch<BusinessSummary>('/business/summary', { headers: { 'X-Admin-Token': token } }),
  // Admin lookup of one customer's account + owned products (license keys, spend).
  getMember: (token: string, email: string) =>
    _fetch<MemberDetail>(`/admin/member?email=${encodeURIComponent(email)}`, {
      headers: { 'X-Admin-Token': token },
    }),
  // Admin revoke of one entitlement (license key × product) — e.g. after a refund.
  revokeEntitlement: (token: string, licenseKey: string, productId: string, reason?: string) =>
    _fetch<{ ok: boolean }>('/admin/entitlement/revoke', {
      method: 'POST',
      headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: licenseKey, product_id: productId, reason }),
    }),
  adminLogin: (token: string) =>
    _fetch<{ ok: boolean }>('/admin/login', { method: 'POST', headers: { 'X-Admin-Token': token } }),
  // Sales ledger CSV export (admin-gated) — returns the raw blob for client download.
  getSalesCsv: async (token: string): Promise<Blob> => {
    const res = await fetch(`${getApiBase()}/business/sales.csv`, {
      headers: { 'X-Admin-Token': token, 'ngrok-skip-browser-warning': 'true' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.blob()
  },
  // Customer roster CSV export (admin-gated) — signup date + lifetime spend.
  getMembersCsv: async (token: string): Promise<Blob> => {
    const res = await fetch(`${getApiBase()}/business/members.csv`, {
      headers: { 'X-Admin-Token': token, 'ngrok-skip-browser-warning': 'true' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.blob()
  },
  setPlan: (plan: string) =>
    _fetch<UsageSummary>('/mlops/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ plan }),
    }),
  // Storefront customer auth (login / sign-up) — header-token, email-keyed.
  register: (email: string, password: string, name?: string) =>
    _fetch<AuthResult>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    _fetch<AuthResult>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  authMe: (token: string) =>
    _fetch<{ user: AuthUser }>('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
  logout: (token: string) =>
    _fetch<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
  // '내 보관함' — the logged-in customer's owned products + license keys for re-download.
  getLibrary: (token: string) =>
    _fetch<Library>('/auth/library', { headers: { Authorization: `Bearer ${token}` } }),
  // '주문 내역' — the customer's purchase history + spend total.
  getOrders: (token: string) =>
    _fetch<Orders>('/auth/orders', { headers: { Authorization: `Bearer ${token}` } }),
  // Personal receipt CSV — the requester's own purchases (token-gated blob).
  getOrdersCsv: async (token: string): Promise<Blob> => {
    const res = await fetch(`${getApiBase()}/auth/orders.csv`, {
      headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.blob()
  },
  // Account settings — edit name, change password (invalidates sessions), delete account.
  updateProfile: (token: string, name: string | null) =>
    _fetch<{ user: AuthUser }>('/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    }),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    _fetch<{ ok: boolean }>('/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  deleteAccount: (token: string, password: string) =>
    _fetch<{ ok: boolean }>('/auth/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    }),
}
