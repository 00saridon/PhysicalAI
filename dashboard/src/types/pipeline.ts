export type StageStatus = 'done' | 'running' | 'pending' | 'error'
export type StageId = 'env' | 'collect' | 'il' | 'rl' | 'export'
export type ArtifactType = 'onnx' | 'hdf5' | 'pt' | 'zip'

export interface Stage {
  id: StageId
  name: string
  status: StageStatus
  detail: string
}

export interface PipelineStatus {
  running: boolean
  stage: StageId | null
}

export interface Artifact {
  id: string
  name: string
  path: string
  size_bytes: number
  type: ArtifactType
  created_at: string
}

export interface LogLine {
  ts: number
  level: 'INFO' | 'WARN' | 'ERROR' | 'RL' | 'IL' | 'RAW'
  text: string
}

export interface MetricPoint {
  step: number
  rew_mean?: number
  loss?: number
  stage: 'rl' | 'il'
  ts: number
}

export function parseLogLevel(line: string): LogLine['level'] {
  if (line.includes('[WARN]') || line.includes('Warning')) return 'WARN'
  if (line.includes('[ERROR]') || line.includes('Error')) return 'ERROR'
  if (line.includes('[RL]')) return 'RL'
  if (line.includes('[IL]')) return 'IL'
  if (line.includes('[INFO]')) return 'INFO'
  return 'RAW'
}
