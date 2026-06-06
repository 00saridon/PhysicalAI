import { useState } from 'react'
import { clsx } from 'clsx'
import { useAuth } from '../../auth/AuthContext'

type Mode = 'login' | 'register'

export function AuthModal({ initialMode = 'login', onClose }: { initialMode?: Mode; onClose: () => void }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!email.trim() || !password) return
    setBusy(true)
    setErr(null)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await register(email.trim(), password, name.trim() || undefined)
      onClose()
    } catch (e) {
      // _fetch throws "<status> <text>: <body>" — surface the JSON detail if present.
      const msg = e instanceof Error ? e.message : '오류가 발생했습니다.'
      const match = msg.match(/\{"detail":"([^"]+)"\}/)
      setErr(match ? match[1] : msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60" onClick={onClose}>
      <div
        className="mt-24 w-full max-w-sm bg-panel border border-border rounded-xl p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#0d1117] rounded-lg">
          {(['login', 'register'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setErr(null) }}
              className={clsx(
                'flex-1 text-xs font-bold py-1.5 rounded-md transition-colors',
                mode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted text-center">
          {mode === 'login'
            ? 'ODIN 계정으로 로그인하면 구매·라이선스가 연동됩니다.'
            : '이메일로 가입하면 구매한 데이터셋·정책이 계정에 귀속됩니다.'}
        </p>

        <div className="flex flex-col gap-2.5">
          {mode === 'register' && (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="이름 (선택)"
              className="bg-[#0d1117] border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-400"
            />
          )}
          <input
            type="email"
            value={email}
            autoFocus
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="이메일"
            className="bg-[#0d1117] border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-400"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder={mode === 'register' ? '비밀번호 (6자 이상)' : '비밀번호'}
            className="bg-[#0d1117] border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-400"
          />
        </div>

        {err && <p className="text-[11px] text-rose-400">{err}</p>}

        <button
          onClick={submit}
          disabled={busy || !email.trim() || !password}
          className="text-xs font-bold py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
        </button>
      </div>
    </div>
  )
}
