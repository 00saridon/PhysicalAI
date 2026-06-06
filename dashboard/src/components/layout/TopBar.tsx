import { clsx } from 'clsx'
import type { NavPage } from '../../App'
import { ModeToggle } from './ModeToggle'
import { AuthMenu } from '../auth/AuthMenu'

interface Props {
  page: NavPage
  onMenuToggle: () => void
  onNavHome: () => void
  onNavAdmin: () => void
  onNewRun: () => void
  running: boolean
  mock: boolean
  realAvailable: boolean
  onSetMode: (mock: boolean) => void
  modePending?: boolean
}

export function TopBar({ page, onMenuToggle, onNavHome, onNavAdmin, onNewRun, running, mock, realAvailable, onSetMode, modePending }: Props) {
  return (
    <header className="h-12 flex-shrink-0 bg-panel border-b border-border flex items-center px-4 gap-3">
      {/* 모바일 햄버거 버튼 */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-slate-400 hover:text-slate-200 text-xl leading-none flex-shrink-0"
      >☰</button>

      <div className="flex items-center gap-1.5 text-xs text-muted">
        <button
          onClick={onNavHome}
          className="hidden sm:inline hover:text-slate-200 transition-colors cursor-pointer"
        >PhysicalAI</button>
        <span className="hidden sm:inline text-border">/</span>
        <span className="text-slate-300 font-semibold">{page}</span>
      </div>

      <div className="flex-1" />

      <ModeToggle mock={mock} onChange={onSetMode} disabled={running || modePending} pending={modePending} realAvailable={realAvailable} />

      <button
        onClick={onNewRun}
        disabled={running}
        className={clsx(
          'text-xs font-semibold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap',
          running
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
        )}
      >
        {running ? '⟳ Running...' : '▶ New Run'}
      </button>

      <div className="w-px h-5 bg-border mx-0.5 hidden sm:block" />

      {/* 관리자 진입점 — 회원정보 바로 옆(우측 상단) */}
      <button
        onClick={onNavAdmin}
        title="관리자 대시보드"
        className={clsx(
          'text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap flex items-center gap-1',
          page === 'Admin'
            ? 'bg-nvidia/10 text-nvidia border border-nvidia/30'
            : 'text-slate-400 hover:bg-border hover:text-slate-200 border border-transparent'
        )}
      >
        <span>🔐</span>
        <span className="hidden sm:inline">Admin</span>
      </button>

      <AuthMenu />
    </header>
  )
}
