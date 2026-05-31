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

export function useArtifacts() {
  return useQuery({
    queryKey: ['artifacts'],
    queryFn: api.getArtifacts,
    refetchInterval: 5000,
  })
}
