import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Overview } from './pages/Overview';
import { Run } from './pages/Run';
import { Training } from './pages/Training';
import { Demos } from './pages/Demos';
import { Artifacts } from './pages/Artifacts';
import { Config } from './pages/Config';
import { usePipelineStatus, useRunStage } from './hooks/usePipeline';
function PageContent({ page }) {
    switch (page) {
        case 'Overview': return _jsx(Overview, {});
        case 'Run': return _jsx(Run, {});
        case 'Training': return _jsx(Training, {});
        case 'Demos': return _jsx(Demos, {});
        case 'Artifacts': return _jsx(Artifacts, {});
        case 'Config': return _jsx(Config, {});
    }
}
export default function App() {
    const [page, setPage] = useState('Overview');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { data: status } = usePipelineStatus();
    const { mutate: runStage } = useRunStage();
    const scrollRef = useRef(null);
    const handleNav = (p) => {
        setPage(p);
        setSidebarOpen(false);
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    return (_jsxs("div", { className: "h-screen flex overflow-hidden bg-surface text-slate-200", children: [sidebarOpen && (_jsx("div", { className: "fixed inset-0 bg-black/60 z-20 lg:hidden", onClick: () => setSidebarOpen(false) })), _jsx(Sidebar, { status: status, activePage: page, onNav: handleNav, isOpen: sidebarOpen, onClose: () => setSidebarOpen(false) }), _jsxs("div", { className: "flex-1 flex flex-col min-w-0", children: [_jsx(TopBar, { page: page, onMenuToggle: () => setSidebarOpen(o => !o), onNavHome: () => handleNav('Overview'), onNewRun: () => runStage({ stage: 'env', validate: true }), running: status?.running ?? false, mockMode: true }), _jsx("div", { ref: scrollRef, className: "flex-1 overflow-y-auto", children: _jsx(PageContent, { page: page }) })] })] }));
}
