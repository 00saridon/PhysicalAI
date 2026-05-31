import type { Artifact, PipelineStatus, StageId } from '../types/pipeline'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function _fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
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

export const api = {
  health: () => _fetch<{ status: string }>('/health'),
  getStatus: () => _fetch<PipelineStatus>('/status'),
  runStage: (stage: StageId, options?: { validate?: boolean }) => {
    const params = new URLSearchParams()
    if (options?.validate) params.set('validate', 'true')
    const qs = params.toString() ? `?${params}` : ''
    return _fetch<{ started: string }>(`/run/${stage}${qs}`, { method: 'POST' })
  },
  getArtifacts: () => _fetch<Artifact[]>('/artifacts'),
  artifactDownloadUrl: (id: string) => `${BASE}/artifacts/${id}/download`,
  getDemos: () => _fetch<DemoFile[]>('/demos'),
  getConfig: () => _fetch<ConfigMap>('/config'),
}
