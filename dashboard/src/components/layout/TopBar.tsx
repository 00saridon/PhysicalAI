import { clsx } from 'clsx'
import type { NavPage } from '../../App'
import { ModeToggle } from './ModeToggle'

interface Props {
  page: NavPage
  onMenuToggle: () => void
  onNavHome: () => void
  onNewRun: () => void
  running: boolean
  mock: boolean
  onSetMode: (mock: boolean) => void
  modePending?: boolean
}

export function TopBar({ page, onMenuToggle, onNavHome, onNewRun, running, mock, onSetMode, modePending }: Props) {
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

      <ModeToggle mock={mock} onChange={onSetMode} disabled={running || modePending} pending={modePending} />

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
