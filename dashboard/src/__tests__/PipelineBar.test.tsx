import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../components/ui/StatusBadge'
import { PipelineBar } from '../components/pipeline/PipelineBar'
import type { Stage } from '../types/pipeline'

describe('StatusBadge', () => {
  it('renders done badge', () => {
    render(<StatusBadge status="done" />)
    expect(screen.getByText('done')).toBeInTheDocument()
  })
  it('renders running badge', () => {
    render(<StatusBadge status="running" />)
    expect(screen.getByText('running')).toBeInTheDocument()
  })
  it('renders error badge', () => {
    render(<StatusBadge status="error" />)
    expect(screen.getByText('error')).toBeInTheDocument()
  })
})

const STAGES: Stage[] = [
  { id: 'env', name: 'ENV', status: 'done', detail: 'Validated' },
  { id: 'collect', name: 'COLLECT', status: 'done', detail: '10 eps' },
  { id: 'il', name: 'IL', status: 'done', detail: 'best.pt' },
  { id: 'rl', name: 'RL', status: 'running', detail: 'Step 32k' },
  { id: 'export', name: 'EXPORT', status: 'pending', detail: '' },
]

describe('PipelineBar', () => {
  it('renders all 5 stage names', () => {
    render(<PipelineBar stages={STAGES} />)
    expect(screen.getByText('ENV')).toBeInTheDocument()
    expect(screen.getByText('COLLECT')).toBeInTheDocument()
    expect(screen.getByText('IL')).toBeInTheDocument()
    expect(screen.getByText('RL')).toBeInTheDocument()
    expect(screen.getByText('EXPORT')).toBeInTheDocument()
  })

  it('shows detail text for done stages', () => {
    render(<PipelineBar stages={STAGES} />)
    expect(screen.getByText('Validated')).toBeInTheDocument()
    expect(screen.getByText('10 eps')).toBeInTheDocument()
  })
})
