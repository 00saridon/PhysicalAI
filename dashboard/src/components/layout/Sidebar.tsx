import { useState } from 'react'
import { clsx } from 'clsx'
import type { PipelineStatus } from '../../types/pipeline'
import type { NavPage } from '../../App'
import type { ResourceKind } from '../../pages/Resources'

interface NavItem {
  label: NavPage
  icon: string
  children?: { key: ResourceKind; label: string; icon: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',  icon: '◈' },
  { label: 'Run',       icon: '▶' },
  { label: 'Training',  icon: '📈' },
  { label: 'Resources', icon: '🖥', children: [
    { key: 'gpu',   label: 'GPU',       icon: '🖥' },
    { key: 'colab', label: 'COLAB GPU', icon: '⚡' },
  ] },
  { label: 'Demos',     icon: '🗄' },
  { label: 'Simulation', icon: '🦾' },
  { label: 'Datasets',  icon: '🛒' },
  { label: 'Marketplace', icon: '🧠' },
  { label: 'MLOps',     icon: '🧪' },
  { label: 'Artifacts', icon: '📦' },
  { label: 'Config',    icon: '⚙' },
]

interface Props {
  status: PipelineStatus | undefined
  activePage: NavPage
  onNav: (page: NavPage) => void
  resource: ResourceKind
  onSelectResource: (r: ResourceKind) => void
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ status, activePage, onNav, resource, onSelectResource, isOpen, onClose }: Props) {
  const [logoOk, setLogoOk] = useState(true)
  return (
    <aside className={clsx(
      'w-56 flex-shrink-0 bg-panel border-r border-border flex flex-col z-30 transition-transform duration-300',
      'fixed inset-y-0 left-0 lg:static lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <button
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onNav('Overview')}
        >
          <div className="rounded-md bg-white px-1.5 py-1 flex items-center shadow-md shadow-black/30">
            {logoOk ? (
              <img
                src="/odin-logo.png"
                alt="ODIN"
                className="h-6 w-auto object-contain"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <span className="text-lg font-black leading-none tracking-tight" style={{ color: '#9B1B30' }}>ODIN</span>
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-black text-slate-100 leading-tight">PhysicalAI</p>
            <p className="text-[9px] font-bold text-nvidia/70 uppercase tracking-widest">an ODIN Project</p>
          </div>
        </button>
        <button
          onClick={onClose}
          className="lg:hidden text-slate-400 hover:text-slate-200 text-lg leading-none"
        >✕</button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <div key={item.label}>
            <div
              onClick={() => onNav(item.label)}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors',
                activePage === item.label
                  ? 'bg-nvidia/10 text-nvidia border border-nvidia/20'
                  : 'text-slate-400 hover:bg-border hover:text-slate-200 border border-transparent'
              )}
            >
              <span>{item.icon}</span>
              <span className="font-semibold">{item.label}</span>
            </div>
            {/* 하위 항목 (Resources → GPU / COLAB GPU) */}
            {item.children && (
              <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
                {item.children.map(child => {
                  const active = activePage === item.label && resource === child.key
                  return (
                    <div
                      key={child.key}
                      onClick={() => onSelectResource(child.key)}
                      className={clsx(
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors',
                        active
                          ? 'bg-nvidia/10 text-nvidia'
                          : 'text-slate-500 hover:bg-border hover:text-slate-300'
                      )}
                    >
                      <span className="text-[11px]">{child.icon}</span>
                      <span className="font-semibold">{child.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Status indicator */}
      <div className="p-3 border-t border-border">
        <div className={clsx(
          'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors',
          status?.running ? 'bg-nvidia/5 border-nvidia/20' : 'bg-surface border-border'
        )}>
          <span className={clsx(
            'w-2 h-2 rounded-full flex-shrink-0',
            status?.running ? 'bg-nvidia animate-pulse' : 'bg-slate-700'
          )} />
          <div>
            <p className={clsx('text-xs font-bold', status?.running ? 'text-nvidia' : 'text-slate-500')}>
              {status?.running ? `${status.stage?.toUpperCase()} 실행 중` : 'Idle'}
            </p>
            <p className="text-[9px] text-slate-600">Isaac Lab</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
