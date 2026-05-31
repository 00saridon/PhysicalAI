import { useRef, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { Overview } from './pages/Overview'
import { Run } from './pages/Run'
import { Training } from './pages/Training'
import { Demos } from './pages/Demos'
import { Artifacts } from './pages/Artifacts'
import { Config } from './pages/Config'
import { usePipelineStatus, useRunStage } from './hooks/usePipeline'

export type NavPage = 'Overview' | 'Run' | 'Training' | 'Demos' | 'Artifacts' | 'Config'

function PageContent({ page }: { page: NavPage }) {
  switch (page) {
    case 'Overview':  return <Overview />
    case 'Run':       return <Run />
    case 'Training':  return <Training />
    case 'Demos':     return <Demos />
    case 'Artifacts': return <Artifacts />
    case 'Config':    return <Config />
  }
}

export default function App() {
  const [page, setPage] = useState<NavPage>('Overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: status } = usePipelineStatus()
  const { mutate: runStage } = useRunStage()
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleNav = (p: NavPage) => {
    setPage(p)
    setSidebarOpen(false)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
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
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          page={page}
          onMenuToggle={() => setSidebarOpen(o => !o)}
          onNavHome={() => handleNav('Overview')}
          onNewRun={() => runStage({ stage: 'env', validate: true })}
          running={status?.running ?? false}
          mockMode
        />
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <PageContent page={page} />
        </div>
      </div>
    </div>
  )
}
