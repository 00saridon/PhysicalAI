import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogPanel } from '../components/monitoring/LogPanel';
const LINES = [
    { ts: 1000, level: 'INFO', text: 'ENV OK - obs keys: [...]' },
    { ts: 1001, level: 'RL', text: '[RL] Step 100 | rew=-0.04' },
    { ts: 1002, level: 'WARN', text: 'No compatible IL layers' },
];
describe('LogPanel', () => {
    it('renders all log lines', () => {
        render(_jsx(LogPanel, { lines: LINES, connected: true }));
        expect(screen.getByText(/ENV OK/)).toBeInTheDocument();
        expect(screen.getByText(/Step 100/)).toBeInTheDocument();
        expect(screen.getByText(/No compatible IL layers/)).toBeInTheDocument();
    });
    it('shows connected indicator', () => {
        render(_jsx(LogPanel, { lines: [], connected: true }));
        expect(screen.getByText('LIVE')).toBeInTheDocument();
    });
    it('shows disconnected indicator', () => {
        render(_jsx(LogPanel, { lines: [], connected: false }));
        expect(screen.getByText('OFFLINE')).toBeInTheDocument();
    });
});
