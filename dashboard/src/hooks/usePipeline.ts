import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getDefaultApiBase } from '../api/base'
import type { StageId } from '../types/pipeline'

export function usePipelineStatus() {
  return useQuery({
    queryKey: ['pipeline-status'],
    queryFn: api.getStatus,
    refetchInterval: 2000,
  })
}

export function useRunStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stage, validate }: { stage: StageId; validate?: boolean }) =>
      api.runStage(stage, { validate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-status'] }),
  })
}

export function useStopStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.stopStage(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-status'] }),
  })
}

/** Polls the build-time (Railway) backend for the latest self-registered Colab
 *  GPU URL, so the dashboard can auto-connect after the notebook runs. */
export function useColabLatest(enabled: boolean) {
  return useQuery({
    queryKey: ['colab-latest'],
    enabled,
    refetchInterval: 4000,
    queryFn: async (): Promise<{ url: string | null; ts: number }> => {
      const res = await fetch(`${getDefaultApiBase()}/colab/latest`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`${res.status}`)
      return res.json()
    },
  })
}

export function useSystem() {
  return useQuery({
    queryKey: ['system'],
    queryFn: api.getSystem,
    refetchInterval: 2000,
  })
}

export function usePipelineMode() {
  return useQuery({
    queryKey: ['pipeline-mode'],
    queryFn: api.getMode,
    refetchInterval: 5000,
  })
}

export function useSetMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mock: boolean) => api.setMode(mock),
    onSuccess: (data) => {
      qc.setQueryData(['pipeline-mode'], data)
      qc.invalidateQueries({ queryKey: ['pipeline-mode'] })
    },
  })
}

export function useArtifacts() {
  return useQuery({
    queryKey: ['artifacts'],
    queryFn: api.getArtifacts,
    refetchInterval: 5000,
  })
}

export function useDemos() {
  return useQuery({
    queryKey: ['demos'],
    queryFn: api.getDemos,
    refetchInterval: 5000,
  })
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
  })
}
