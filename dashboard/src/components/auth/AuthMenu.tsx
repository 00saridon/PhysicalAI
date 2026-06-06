import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { usePurchase } from '../../auth/PurchaseContext'
import { AuthModal } from './AuthModal'
import { AccountModal } from './AccountModal'
import { OrdersModal } from './OrdersModal'

/** Top-right account control: login/sign-up when logged out, account menu when in. */
export function AuthMenu() {
  const { user, loading, logout } = useAuth()
  const { openLibrary } = usePurchase()
  const [modal, setModal] = useState<'login' | 'register' | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [open, setOpen] = useState(false)

  if (loading) {
    return <div className="w-16 h-6 rounded bg-border/50 animate-pulse" />
  }

  if (user) {
    const label = user.name || user.email.split('@')[0]
    const initial = (user.name || user.email).charAt(0).toUpperCase()
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-slate-100 transition-colors"
        >
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black">
            {initial}
          </span>
          <span className="hidden sm:inline max-w-[120px] truncate">{label}</span>
          <span className="text-[8px] text-slate-500">▼</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-2 w-52 bg-panel border border-border rounded-lg shadow-xl shadow-black/40 z-50 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-xs font-bold text-slate-200 truncate">{user.name || '회원'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={() => { setOpen(false); openLibrary() }}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-border hover:text-slate-200 transition-colors border-b border-border"
              >
                📚 내 보관함
              </button>
              <button
                onClick={() => { setOpen(false); setOrdersOpen(true) }}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-border hover:text-slate-200 transition-colors border-b border-border"
              >
                🧾 주문 내역
              </button>
              <button
                onClick={() => { setOpen(false); setAccountOpen(true) }}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-border hover:text-slate-200 transition-colors border-b border-border"
              >
                ⚙ 계정 설정
              </button>
              <button
                onClick={() => { setOpen(false); logout() }}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-border hover:text-slate-200 transition-colors"
              >
                🚪 로그아웃
              </button>
            </div>
          </>
        )}
        {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
        {ordersOpen && <OrdersModal onClose={() => setOrdersOpen(false)} />}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setModal('login')}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-border hover:text-slate-100 transition-colors whitespace-nowrap"
        >
          로그인
        </button>
        <button
          onClick={() => setModal('register')}
          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-nvidia/10 text-nvidia border border-nvidia/30 hover:bg-nvidia/20 transition-colors whitespace-nowrap"
        >
          회원가입
        </button>
      </div>
      {modal && <AuthModal initialMode={modal} onClose={() => setModal(null)} />}
    </>
  )
}
