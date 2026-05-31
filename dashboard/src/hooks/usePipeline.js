import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
export function usePipelineStatus() {
    return useQuery({
        queryKey: ['pipeline-status'],
        queryFn: api.getStatus,
        refetchInterval: 2000,
    });
}
export function useRunStage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ stage, validate }) => api.runStage(stage, { validate }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-status'] }),
    });
}
export function useArtifacts() {
    return useQuery({
        queryKey: ['artifacts'],
        queryFn: api.getArtifacts,
        refetchInterval: 5000,
    });
}
