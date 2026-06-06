import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, type AuthUser } from '../api/client'
import { getAuthToken, setAuthToken, setLicenseKey } from '../api/base'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  updateName: (name: string | null) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  deleteAccount: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount, validate any persisted token against the backend. An invalid or
  // stale token (e.g. server restarted, sessions cleared) silently logs out.
  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }
    api.authMe(token)
      .then(({ user }) => setUser(user))
      .catch(() => setAuthToken(''))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login(email, password)
    setAuthToken(token)
    setUser(user)
  }, [])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const { token, user } = await api.register(email, password, name)
    setAuthToken(token)
    setUser(user)
  }, [])

  const logout = useCallback(() => {
    const token = getAuthToken()
    if (token) api.logout(token).catch(() => { /* best-effort revoke */ })
    setAuthToken('')
    // Drop the account-filled license key so it can't leak to the next user on a
    // shared device. Storefront pages also clear their in-memory key on logout.
    setLicenseKey('')
    setUser(null)
  }, [])

  const updateName = useCallback(async (name: string | null) => {
    const token = getAuthToken()
    if (!token) throw new Error('로그인이 필요합니다.')
    const { user } = await api.updateProfile(token, name)
    setUser(user)
  }, [])

  // A password change invalidates every session server-side, so we drop the
  // stale token and log out locally — the user re-authenticates with the new one.
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const token = getAuthToken()
    if (!token) throw new Error('로그인이 필요합니다.')
    await api.changePassword(token, currentPassword, newPassword)
    setAuthToken('')
    setUser(null)
  }, [])

  const deleteAccount = useCallback(async (password: string) => {
    const token = getAuthToken()
    if (!token) throw new Error('로그인이 필요합니다.')
    await api.deleteAccount(token, password)
    setAuthToken('')
    setLicenseKey('')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateName, changePassword, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
