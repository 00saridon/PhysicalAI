import type { Artifact, PipelineStatus, StageId } from '../types/pipeline'
import { getApiBase } from './base'

async function _fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, init)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json() as Promise<T>
}

export interface DemoFile {
  name: string
  path: string
  size_bytes: number
  created_at: number
}

export type ConfigMap = Record<string, unknown>

export interface Trajectory {
  name: string
  n_total: number
  stride: number
  count: number
  joint_dim: number
  action_dim: number
  has_rgb: boolean
  joints: number[][]
  actions: number[][]
  rewards: number[]
}

export const api = {
  health: () => _fetch<{ status: string }>('/health'),
  getStatus: () => _fetch<PipelineStatus>('/status'),
  runStage: (stage: StageId, options?: { validate?: boolean }) => {
    const params = new URLSearchParams()
    if (options?.validate) params.set('validate', 'true')
    const qs = params.toString() ? `?${params}` : ''
    return _fetch<{ started: string }>(`/run/${stage}${qs}`, { method: 'POST' })
  },
  stopStage: () => _fetch<{ stopped: StageId | null }>('/stop', { method: 'POST' }),
  getMode: () => _fetch<{ mock: boolean; real_available: boolean }>('/mode'),
  setMode: (mock: boolean) =>
    _fetch<{ mock: boolean; real_available: boolean }>('/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mock }),
    }),
  getArtifacts: () => _fetch<Artifact[]>('/artifacts'),
  artifactDownloadUrl: (id: string) => `${getApiBase()}/artifacts/${id}/download`,
  getDemos: () => _fetch<DemoFile[]>('/demos'),
  getConfig: () => _fetch<ConfigMap>('/config'),
  getTrajectory: (name = 'synthetic_v1', frames = 240) =>
    _fetch<Trajectory>(`/dataset/trajectory?name=${encodeURIComponent(name)}&frames=${frames}`),
}
