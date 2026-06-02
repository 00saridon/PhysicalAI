import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
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
