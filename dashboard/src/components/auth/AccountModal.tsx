import { useState } from 'react'
import { clsx } from 'clsx'
import { useAuth } from '../../auth/AuthContext'

/** 계정 설정 — edit display name, change password, or delete the account.
 * A password change or deletion logs the user out (the modal closes itself). */
export function AccountModal({ onClose }: { onClose: () => void }) {
  const { user, updateName, changePassword, deleteAccount } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [delPw, setDelPw] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState<'name' | 'pw' | 'delete' | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const detail = (e: unknown) => {
    const m = e instanceof Error ? e.message : '오류가 발생했습니다.'
    const match = m.match(/\{"detail":"([^"]+)"\}/)
    return match ? match[1] : m
  }

  const saveName = async () => {
    setBusy('name'); setMsg(null)
    try {
      await updateName(name.trim() || null)
      setMsg({ kind: 'ok', text: '이름이 변경되었습니다.' })
    } catch (e) {
      setMsg({ kind: 'err', text: detail(e) })
    } finally { setBusy(null) }
  }

  const savePassword = async () => {
    if (!curPw || !newPw) return
    setBusy('pw'); setMsg(null)
    try {
      await changePassword(curPw, newPw)
      // changePassword logs out → modal becomes orphaned; close it.
      onClose()
    } catch (e) {
      setMsg({ kind: 'err', text: detail(e) })
      setBusy(null)
    }
  }

  const removeAccount = async () => {
    if (!delPw) return
    setBusy('delete'); setMsg(null)
    try {
      await deleteAccount(delPw)
      onClose()
    } catch (e) {
      setMsg({ kind: 'err', text: detail(e) })
      setBusy(null)
    }
  }

  const inputCls = 'bg-[#0d1117] border border-border rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-400'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60" onClick={onClose}>
      <div
        className="mt-20 w-full max-w-sm bg-panel border border-border rounded-xl p-6 flex flex-col gap-5 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">⚙ 계정 설정</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>
        <p className="text-[10px] text-slate-500 -mt-3 truncate">{user?.email}</p>

        {msg && (
          <p className={clsx('text-[11px]', msg.kind === 'ok' ? 'text-emerald-400' : 'text-rose-400')}>
            {msg.text}
          </p>
        )}

        {/* Display name */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold text-slate-400">이름</h3>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="이름 (선택)" className={inputCls} />
          <button
            onClick={saveName}
            disabled={busy === 'name'}
            className="text-xs font-bold py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            {busy === 'name' ? '저장 중…' : '이름 저장'}
          </button>
        </section>

        <div className="h-px bg-border" />

        {/* Password */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold text-slate-400">비밀번호 변경</h3>
          <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="현재 비밀번호" className={inputCls} />
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호 (6자 이상)" className={inputCls} />
          <p className="text-[10px] text-slate-600">변경 시 모든 기기에서 로그아웃되며 다시 로그인해야 합니다.</p>
          <button
            onClick={savePassword}
            disabled={busy === 'pw' || !curPw || !newPw}
            className="text-xs font-bold py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            {busy === 'pw' ? '변경 중…' : '비밀번호 변경'}
          </button>
        </section>

        <div className="h-px bg-border" />

        {/* Danger zone */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold text-rose-400">회원 탈퇴</h3>
          {!confirmDelete ? (
            <button
              onClick={() => { setConfirmDelete(true); setMsg(null) }}
              className="text-xs font-bold py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              계정 삭제
            </button>
          ) : (
            <>
              <p className="text-[10px] text-slate-500">
                계정을 삭제해도 이미 구매한 라이선스는 유효합니다. 확인을 위해 비밀번호를 입력하세요.
              </p>
              <input type="password" value={delPw} onChange={e => setDelPw(e.target.value)} placeholder="비밀번호" className={inputCls} />
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirmDelete(false); setDelPw('') }}
                  className="flex-1 text-xs font-bold py-1.5 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={removeAccount}
                  disabled={busy === 'delete' || !delPw}
                  className="flex-1 text-xs font-bold py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-500 transition-colors disabled:opacity-50"
                >
                  {busy === 'delete' ? '삭제 중…' : '영구 삭제'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
