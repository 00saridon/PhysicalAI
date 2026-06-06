import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { Overview } from './pages/Overview'
import { Run } from './pages/Run'
import { Training } from './pages/Training'
import { Demos } from './pages/Demos'
import { Datasets } from './pages/Datasets'
import { Marketplace } from './pages/Marketplace'
import { MLOps } from './pages/MLOps'
import { Artifacts } from './pages/Artifacts'
import { Admin } from './pages/Admin'
import { Config } from './pages/Config'
import { Resources, type ResourceKind } from './pages/Resources'
import { consumeLanding, getApiOverride, setApiOverride, reloadWithLanding } from './api/base'
import { AuthProvider } from './auth/AuthContext'
import { PurchaseProvider } from './auth/PurchaseContext'

// Lazy-load the 3D page so three.js is split into its own chunk (loaded on demand)
const Simulation = lazy(() => import('./pages/Simulation').then(m => ({ default: m.Simulation })))
import { usePipelineStatus, useRunStage, usePipelineMode, useSetMode } from './hooks/usePipeline'

export type NavPage = 'Overview' | 'Run' | 'Training' | 'Resources' | 'Demos' | 'Simulation' | 'Datasets' | 'Marketplace' | 'MLOps' | 'Artifacts' | 'Admin' | 'Config'

function PageContent({ page, onNav, resource, onSelectResource }: {
  page: NavPage
  onNav: (p: NavPage) => void
  resource: ResourceKind
  onSelectResource: (r: ResourceKind) => void
}) {
  switch (page) {
    case 'Overview':   return <Overview />
    case 'Run':        return <Run />
    case 'Training':   return <Training onNav={onNav} />
    case 'Resources':  return <Resources resource={resource} onSelectResource={onSelectResource} />
    case 'Demos':      return <Demos onNav={onNav} />
    case 'Simulation': return (
      <Suspense fallback={<div className="p-8 text-sm text-muted">3D 뷰 로딩 중…</div>}>
        <Simulation />
      </Suspense>
    )
    case 'Datasets':   return <Datasets />
    case 'Marketplace': return <Marketplace />
    case 'MLOps':      return <MLOps />
    case 'Artifacts':  return <Artifacts />
    case 'Admin':      return <Admin onExit={() => onNav('Overview')} />
    case 'Config':     return <Config />
  }
}

export default function App() {
  const [page, setPage] = useState<NavPage>('Overview')
  const [resource, setResource] = useState<ResourceKind>('gpu')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: status } = usePipelineStatus()
  const { mutate: runStage } = useRunStage()
  const { data: mode } = usePipelineMode()
  const { mutate: setMode, isPending: modePending } = useSetMode()
  const scrollRef = useRef<HTMLDivElement>(null)

  // On first load / refresh, land on the Overview hero (top) — unless a backend
  // switch asked us to stay put (e.g. Resources → COLAB GPU auto-connect reload).
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const landing = consumeLanding()
    if (landing?.page) {
      setPage(landing.page as NavPage)
      if (landing.resource) setResource(landing.resource as ResourceKind)
    } else {
      setPage('Overview')
    }
    const el = scrollRef.current
    el?.scrollTo({ top: 0 })
    // guard against the browser restoring the container's scroll a frame later
    requestAnimationFrame(() => el?.scrollTo({ top: 0 }))
  }, [])

  const handleNav = (p: NavPage) => {
    setPage(p)
    setSidebarOpen(false)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Selecting "GPU" means the default backend, so drop any (possibly dead) Colab
  // override and switch to it — otherwise Run would keep hitting the dead tunnel.
  const selectResource = (r: ResourceKind) => {
    if (r === 'gpu' && getApiOverride()) {
      setApiOverride('')
      reloadWithLanding('Resources', 'gpu')
      return
    }
    setResource(r)
    handleNav('Resources')
  }

  return (
    <AuthProvider>
    <PurchaseProvider>
    <div className="h-screen flex overflow-hidden bg-surface text-slate-200">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        status={status}
        activePage={page}
        onNav={handleNav}
        resource={resource}
        onSelectResource={selectResource}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          page={page}
          onMenuToggle={() => setSidebarOpen(o => !o)}
          onNavHome={() => handleNav('Overview')}
          onNavAdmin={() => handleNav('Admin')}
          onNewRun={() => runStage({ stage: 'env', validate: true })}
          running={status?.running ?? false}
          mock={mode?.mock ?? true}
          realAvailable={mode?.real_available ?? true}
          onSetMode={setMode}
          modePending={modePending}
        />
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <PageContent page={page} onNav={handleNav} resource={resource} onSelectResource={selectResource} />
        </div>
      </div>
    </div>
    </PurchaseProvider>
    </AuthProvider>
  )
}
