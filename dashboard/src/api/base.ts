// Runtime-configurable API backend.
//
// Resolution order for the backend root (no trailing /api):
//   1. ?api=<url> query param — captured once and persisted to localStorage
//      (clears the override when passed empty: ?api=)
//   2. localStorage override (set by a previous ?api= or the Config page)
//   3. VITE_API_URL baked at build time (Netlify → Railway)
//   4. '' (relative — same origin / Vite dev proxy)
//
// This lets the deployed dashboard point at an ad-hoc backend (e.g. a Colab
// GPU instance exposed via a cloudflared tunnel) WITHOUT a rebuild — just open
//   https://<site>/?api=https://<tunnel>.trycloudflare.com

const KEY = 'physicalai.apiUrl'

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

function readOverride(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const q = new URLSearchParams(window.location.search).get('api')
    if (q !== null) {
      if (q === '') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, stripTrailingSlash(q))
    }
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Backend root with no trailing slash, e.g. "https://host" or "". */
export function getApiRoot(): string {
  const override = readOverride()
  if (override) return override
  return stripTrailingSlash((import.meta.env.VITE_API_URL as string | undefined) ?? '')
}

/** Backend API base including the /api prefix. */
export function getApiBase(): string {
  return getApiRoot() + '/api'
}

/** The build-time backend API base, ignoring any runtime override. Used for the
 *  Colab registry so the dashboard can discover a tunnel even while pointed at one. */
export function getDefaultApiBase(): string {
  return stripTrailingSlash((import.meta.env.VITE_API_URL as string | undefined) ?? '') + '/api'
}

/** Persist (or clear, when empty) a backend override at runtime. */
export function setApiOverride(url: string): void {
  try {
    const trimmed = stripTrailingSlash(url.trim())
    if (trimmed) localStorage.setItem(KEY, trimmed)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore storage failures */
  }
}

// Connecting to a different backend requires a full reload (re-init API base +
// SSE). Persist the page to land on across that reload so the user stays where
// they were (e.g. Resources → COLAB GPU) instead of bouncing to Overview.
const LANDING_KEY = 'physicalai.landing'

export function reloadWithLanding(page: string, resource?: string): void {
  try {
    sessionStorage.setItem(LANDING_KEY, JSON.stringify({ page, resource }))
  } catch {
    /* ignore */
  }
  window.location.reload()
}

export function consumeLanding(): { page: string; resource?: string } | null {
  try {
    const v = sessionStorage.getItem(LANDING_KEY)
    if (!v) return null
    sessionStorage.removeItem(LANDING_KEY)
    return JSON.parse(v)
  } catch {
    return null
  }
}

// Buyer's dataset license key (DaaS Phase 1). Persisted so paid downloads stay
// unlocked across reloads. Phase 2 billing will set this after a successful
// checkout instead of the user pasting it in.
const LICENSE_KEY = 'physicalai.licenseKey'

export function getLicenseKey(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(LICENSE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setLicenseKey(key: string): void {
  try {
    const trimmed = key.trim()
    if (trimmed) localStorage.setItem(LICENSE_KEY, trimmed)
    else localStorage.removeItem(LICENSE_KEY)
  } catch {
    /* ignore storage failures */
  }
}

// Storefront customer auth token (login / sign-up). Persisted so the session
// survives reloads. Distinct from the admin token and the dataset license key.
const AUTH_TOKEN_KEY = 'physicalai.authToken'

export function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setAuthToken(token: string): void {
  try {
    const trimmed = token.trim()
    if (trimmed) localStorage.setItem(AUTH_TOKEN_KEY, trimmed)
    else localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    /* ignore storage failures */
  }
}

/** The active override, or null when falling back to the build-time default. */
export function getApiOverride(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
