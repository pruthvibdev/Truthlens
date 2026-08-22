export type InputMode = 'text' | 'url' | 'image'

export type AgentId = 'oracle' | 'sentinel' | 'verdict'

export type AgentStatus = 'idle' | 'processing' | 'done' | 'error'

export interface AgentState {
  id: AgentId
  status: AgentStatus
  logs: string[]
  startedAt?: number
  finishedAt?: number
}

export interface OracleResult {
  claim: string
  context: string
  keywords: string[]
}

export interface SourceRef {
  title: string
  url: string
  domain: string
}

export interface SentinelResult {
  facts: string[]
  sources: SourceRef[]
  queries: string[]
  grounded: boolean
}

export type VerdictLabel =
  | 'TRUE'
  | 'MOSTLY TRUE'
  | 'PARTIALLY TRUE'
  | 'MOSTLY FALSE'
  | 'FALSE'
  | 'UNVERIFIABLE'

export interface VerdictResult {
  score: number
  verdict: VerdictLabel
  explanation: string
  corrections: string[]
}

export interface AnalysisResult {
  oracle: OracleResult
  sentinel: SentinelResult
  verdict: VerdictResult
}

export function verdictColor(score: number): string {
  if (score >= 85) return '#39ff6e'  // TRUE
  if (score >= 70) return '#a8ff6e'  // MOSTLY TRUE — lighter green
  if (score >= 40) return '#ffae00'  // PARTIALLY TRUE — amber
  if (score >= 15) return '#ff7b3a'  // MOSTLY FALSE — orange-red
  return '#ff3a6e'                   // FALSE
}