import type {
  AnalysisResult,
  InputMode,
  AgentId,
} from '../types'
import {
  getEffectiveApiKey,
  getEffectiveModel,
  getEffectiveTemperature,
} from './gemini'

export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000'

/** Checks if the Python FastAPI backend is currently running and reachable */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1200)
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

export interface BackendStreamCallbacks {
  onLog: (agent: AgentId, line: string) => void
  onStart: (agent: AgentId) => void
  onDone: (agent: AgentId) => void
  onFail?: (agent: AgentId) => void
}

/**
 * Runs the analysis through the Python FastAPI multi-agent pipeline using SSE streaming.
 */
export async function analyzeWithPythonBackend(
  text: string,
  mode: InputMode,
  callbacks: BackendStreamCallbacks,
): Promise<AnalysisResult> {
  const apiKey = getEffectiveApiKey()
  const model = getEffectiveModel()
  const temperature = getEffectiveTemperature()

  const response = await fetch(`${BACKEND_URL}/api/analyze/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      text,
      mode,
      api_key: apiKey || undefined,
      model,
      temperature,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Python Backend Error (${response.status}): ${errText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Streaming response body is unavailable')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: AnalysisResult | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n\n')
    buffer = lines.pop() ?? ''

    for (const chunk of lines) {
      const trimmed = chunk.trim()
      if (!trimmed.startsWith('data:')) continue
      const jsonStr = trimmed.slice(5).trim()
      if (!jsonStr) continue

      try {
        const event = JSON.parse(jsonStr)
        if (event.type === 'start') {
          callbacks.onStart(event.agent as AgentId)
        } else if (event.type === 'log') {
          callbacks.onLog(event.agent as AgentId, event.line)
        } else if (event.type === 'done') {
          callbacks.onDone(event.agent as AgentId)
        } else if (event.type === 'complete') {
          finalResult = event.result as AnalysisResult
        } else if (event.type === 'error') {
          throw new Error(event.error)
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
          // non-fatal parse warning
        }
      }
    }
  }

  if (!finalResult) {
    throw new Error('Pipeline completed without returning final results')
  }

  return finalResult
}
