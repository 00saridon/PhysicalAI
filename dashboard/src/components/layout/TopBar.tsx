import { clsx } from 'clsx'
import type { NavPage } from '../../App'

interface Props {
  page: NavPage
  onMenuToggle: () => void
  onNavHome: () => void
  onNewRun: () => void
  running: boolean
  mockMode?: boolean
}

export function TopBar({ page, onMenuToggle, onNavHome, onNewRun, running, mockMode }: Props) {
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

      {mockMode && (
        <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-400">
          mock_mode
        </span>
      )}

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
    </header>
  )
}
