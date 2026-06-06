import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getDefaultApiBase, getAuthToken } from '../api/base'
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

export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: api.getCatalog,
    refetchInterval: 10000,
  })
}

/** Trained policies sold in the Skill/Policy Marketplace (Model #3). */
export function usePolicies() {
  return useQuery({
    queryKey: ['policies'],
    queryFn: api.getPolicies,
    refetchInterval: 10000,
  })
}

/** Experiment-tracking runs (Robotics MLOps SaaS — Model #2). */
export function useExperiments() {
  return useQuery({
    queryKey: ['experiments'],
    queryFn: api.getExperiments,
    refetchInterval: 8000,
  })
}

/** Per-robot leaderboard (top runs by success rate). Only fetches when a robot
 *  is selected; '전체' uses the full experiment list instead. */
export function useLeaderboard(robot: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['leaderboard', robot ?? '', limit],
    queryFn: () => api.getLeaderboard(robot, limit),
    enabled: !!robot,
    refetchInterval: 8000,
  })
}

/** GPU-time usage vs the active subscription plan quota (Model #2). */
export function useUsage() {
  return useQuery({
    queryKey: ['mlops-usage'],
    queryFn: api.getUsage,
    refetchInterval: 8000,
  })
}

/** Submit a (mock) training job and refresh tracking + usage. */
export function useSubmitExperiment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (spec: Parameters<typeof api.submitExperiment>[0]) => api.submitExperiment(spec),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiments'] })
      qc.invalidateQueries({ queryKey: ['mlops-usage'] })
    },
  })
}

/** Promote an experiment's checkpoint into the marketplace (Model #2 → #3). */
export function useRegisterModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (expId: string) => api.registerModel(expId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiments'] })
      qc.invalidateQueries({ queryKey: ['mlops-usage'] })
      qc.invalidateQueries({ queryKey: ['policies'] })
    },
  })
}

/** Delete an experiment from the tracker, then refresh tracking + usage. */
export function useDeleteExperiment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (expId: string) => api.deleteExperiment(expId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiments'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
      qc.invalidateQueries({ queryKey: ['mlops-usage'] })
    },
  })
}

/** Change the active subscription plan. */
export function useSetPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (plan: string) => api.setPlan(plan),
    onSuccess: (data) => {
      qc.setQueryData(['mlops-usage'], data)
      qc.invalidateQueries({ queryKey: ['mlops-usage'] })
    },
  })
}

/** Cross-model business rollup for the admin page (revenue + inventory + MLOps).
 *  Admin-gated: only fetches once an admin token is supplied. */
export function useBusinessSummary(token: string) {
  return useQuery({
    queryKey: ['business-summary', token],
    enabled: !!token,
    queryFn: () => api.getBusinessSummary(token),
    refetchInterval: 8000,
    retry: false,
  })
}

/** Products the given license key unlocks (DaaS Phase 1). Empty key → no fetch. */
export function useEntitlements(key: string) {
  return useQuery({
    queryKey: ['entitlements', key],
    enabled: !!key,
    queryFn: () => api.listEntitlements(key),
  })
}

/** The logged-in customer's owned products (by account email) — powers ownership
 * detection and license-key auto-fill across the storefront. `enabled` gates the
 * fetch on login state; invalidate ['library'] after a purchase to refresh. */
export function useLibrary(enabled: boolean) {
  return useQuery({
    // Key by token so a logout/login (different account) never serves stale data.
    queryKey: ['library', getAuthToken()],
    enabled,
    queryFn: () => api.getLibrary(getAuthToken()),
    retry: false,
  })
}

/** Issue a license key for a product (admin/dev stand-in for purchase). */
export function useGrantEntitlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, email, licenseKey }: { productId: string; email?: string; licenseKey?: string }) =>
      api.grantEntitlement(productId, email, licenseKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entitlements'] }),
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
