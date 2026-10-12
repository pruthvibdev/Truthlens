import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, KeyRound, X } from 'lucide-react'
import BackgroundLayer, { Sidebar, type TabId } from './components/layout/GridOverlay'
import InputSection from './components/input/InputSection'
import AgentPipeline from './components/agent/AgentPipeline'
import ResultsDashboard from './components/verdict/ResultsDashboard'
import HistoryView, { type HistoryItem } from './components/history/HistoryView'
import SettingsView from './components/settings/SettingsView'
import {
  getEffectiveApiKey,
  getEffectiveModel,
  getEffectiveTemperature,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  runOracle,
  runSentinel,
  runVerdict,
} from './services/gemini'
import { isBackendAvailable, analyzeWithPythonBackend } from './services/backend'
import { extractTextFromImage, terminateOcrWorker } from './utils/ocr'
import { fetchUrlText } from './utils/url'
import type {
  AgentId,
  AgentState,
  AnalysisResult,
  InputMode,
} from './types'

// Pure utility — lives outside the component so it's never recreated
function dataUrlToFile(dataUrl: string): File {
  const [header, b64] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], 'upload.png', { type: mime })
}

const initialAgents = (): AgentState[] => [
  { id: 'oracle', status: 'idle', logs: [] },
  { id: 'sentinel', status: 'idle', logs: [] },
  { id: 'verdict', status: 'idle', logs: [] },
]

const HISTORY_KEY = 'truthlens_history'

function loadSavedHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupted storage
  }
  return []
}

interface ErrorToastProps {
  message: string
  onDismiss: () => void
}

function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex items-start gap-3 rounded-xl border border-tl-red/30 bg-tl-red/8 p-4 mb-4"
      style={{ background: 'rgba(248,113,113,0.06)' }}
    >
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-tl-red" />
      <p className="font-mono text-xs leading-relaxed text-tl-text flex-1">
        <span className="font-bold text-tl-red">Error: </span>{message}
      </p>
      <button onClick={onDismiss} className="text-tl-muted hover:text-tl-text transition-colors">
        <X size={14} />
      </button>
    </motion.div>
  )
}

interface KeyWarningToastProps {
  onDismiss: () => void
  onOpenSettings: () => void
}

function KeyWarningToast({ onDismiss, onOpenSettings }: KeyWarningToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex items-start gap-3 rounded-xl border border-tl-orange/30 p-4 mb-4"
      style={{ background: 'rgba(251,146,60,0.06)' }}
    >
      <KeyRound size={15} className="mt-0.5 shrink-0 text-tl-orange" />
      <div className="font-mono text-xs leading-relaxed text-tl-text-dim flex-1">
        <span className="font-bold text-tl-orange">GROQ KEY NOT CONFIGURED. </span>
        Configure it in{' '}
        <button
          onClick={onOpenSettings}
          className="text-tl-blue underline underline-offset-2 hover:text-tl-blue-light font-bold"
        >
          Settings
        </button>{' '}
        or add <code className="text-tl-blue bg-tl-blue/10 px-1 rounded">VITE_GROQ_API_KEY</code> to{' '}
        <code className="text-tl-blue bg-tl-blue/10 px-1 rounded">.env.local</code>.
      </div>
      <button onClick={onDismiss} className="text-tl-muted hover:text-tl-text transition-colors">
        <X size={14} />
      </button>
    </motion.div>
  )
}

function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('dashboard')
  const [agents, setAgents] = useState<AgentState[]>(initialAgents)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keyDismissed, setKeyDismissed] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>(loadSavedHistory)

  const [settingsApiKey, setSettingsApiKey] = useState(() => getEffectiveApiKey() ?? '')
  const [settingsModel, setSettingsModel] = useState(() => getEffectiveModel())
  const [settingsTemperature, setSettingsTemperature] = useState(() => getEffectiveTemperature())

  const runIdRef = useRef(0)
  const hasApiKey = Boolean(settingsApiKey || getEffectiveApiKey())

  // Persist history changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {
      // Storage quota exceeded or disabled
    }
  }, [history])

  // Terminate the Tesseract worker when the App unmounts (e.g. HMR, tests)
  useEffect(() => {
    return () => {
      terminateOcrWorker()
    }
  }, [])

  const patchAgent = useCallback((id: AgentId, patch: Partial<AgentState>) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    )
  }, [])

  const pushLog = useCallback(
    (agent: AgentId, line: string) => {
      setAgents((prev) =>
        prev.map((a) => (a.id === agent ? { ...a, logs: [...a.logs, line] } : a)),
      )
    },
    [],
  )
  const pushLogs = useCallback((agent: AgentId, lines: string[]) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agent ? { ...a, logs: [...a.logs, ...lines] } : a)),
    )
  }, [])

  // Wrapped in useCallback so InputSection doesn't re-render on every parent render
  const analyze = useCallback(
    async function analyze({ mode, text }: { mode: InputMode; text: string }) {
      const runId = ++runIdRef.current
      setBusy(true)
      setResult(null)
      setError(null)
      setAgents(initialAgents())

      const onLog: (agent: AgentId, line: string) => void = (agent, line) => {
        if (runId === runIdRef.current) pushLog(agent, line)
      }
      const onStart = (id: AgentId) => {
        if (runId === runIdRef.current) {
          patchAgent(id, { status: 'processing', startedAt: Date.now() })
        }
      }
      const onDone = (id: AgentId) => {
        if (runId === runIdRef.current) {
          patchAgent(id, { status: 'done', finishedAt: Date.now() })
        }
      }
      const onFail = (id: AgentId) => {
        if (runId === runIdRef.current) patchAgent(id, { status: 'error' })
      }

      try {
        let inputText = text

        // Image preprocessing: use oracle card for OCR status, then carry the logs
        // forward into the main oracle pipeline run (no wipe/reset).
        if (mode === 'image') {
          onStart('oracle')
          pushLog('oracle', 'ORACLE ONLINE — OCR preprocessing engaged')
          const file = dataUrlToFile(text)
          try {
            inputText = await extractTextFromImage(file)
            pushLogs('oracle', [
              'OCR COMPLETE — text extracted from image',
              `SOURCE: "${inputText.slice(0, 120)}${inputText.length > 120 ? '…' : ''}"`,
            ])
          } catch (ocrErr) {
            onFail('oracle')
            throw new Error(
              `OCR failed: ${ocrErr instanceof Error ? ocrErr.message : 'unknown error'}`,
            )
          }
        }

        // URL preprocessing: fetch silently with no agent card interaction.
        if (mode === 'url') {
          try {
            inputText = await fetchUrlText(text)
          } catch (fetchErr) {
            if (fetchErr instanceof Error && fetchErr.message === 'CORS_BLOCKED') {
              // Pass the raw URL to oracle for remote analysis
            } else {
              onFail('sentinel')
              throw fetchErr
            }
          }
        }

        let finalResult: AnalysisResult

        const hasBackend = await isBackendAvailable()
        if (hasBackend) {
          finalResult = await analyzeWithPythonBackend(inputText, mode, {
            onLog,
            onStart,
            onDone,
            onFail,
          })
        } else {
          const currentKey = getEffectiveApiKey()
          if (!currentKey) {
            throw new Error('MISSING_KEY')
          }

          onStart('oracle')
          const oracle = await runOracle(inputText, onLog)
          onDone('oracle')

          onStart('sentinel')
          const sentinel = await runSentinel(oracle, onLog)
          onDone('sentinel')

          onStart('verdict')
          const verdict = await runVerdict(oracle, sentinel, onLog)
          onDone('verdict')

          finalResult = { oracle, sentinel, verdict }
        }

        if (runId === runIdRef.current) {
          setResult(finalResult)

          // Save to history automatically
          const newHistoryItem: HistoryItem = {
            id: String(Date.now()),
            timestamp: Date.now(),
            inputMode: mode,
            claim: finalResult.oracle.claim || inputText,
            result: finalResult,
          }
          setHistory((prev) => [newHistoryItem, ...prev.slice(0, 49)])
        }
      } catch (err) {
        if (runId !== runIdRef.current) return
        setAgents((prev) =>
          prev.map((a) => (a.status === 'processing' ? { ...a, status: 'error' } : a)),
        )
        let msg = 'Analysis pipeline failed'
        if (err instanceof Error) {
          if (err.message === 'MISSING_KEY') {
            msg = 'Groq API key not configured. Please enter your free key in Settings, or start the Python backend in backend/.'
          } else if (err.message === 'Failed to fetch') {
            msg = 'Network connection failed (Failed to fetch). Please check your internet, verify your Groq API key in Settings, or make sure the Python backend is running.'
          } else {
            msg = err.message
          }
        }
        setError(msg)
      } finally {
        if (runId === runIdRef.current) setBusy(false)
      }
    },
    [patchAgent, pushLog, pushLogs],
  )

  function handleSelectHistoryItem(item: HistoryItem) {
    setResult(item.result)
    setError(null)
    setAgents(initialAgents())
    setCurrentTab('dashboard')
  }

  function handleClearHistory() {
    setHistory([])
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {
      // ignore
    }
  }

  function handleDeleteHistoryItem(id: string) {
    setHistory((prev) => prev.filter((item) => item.id !== id))
  }

  function handleSaveSettings(newSettings: {
    apiKey: string
    model: string
    temperature: number
  }) {
    if (newSettings.apiKey) {
      localStorage.setItem('truthlens_api_key', newSettings.apiKey)
    } else {
      localStorage.removeItem('truthlens_api_key')
    }
    localStorage.setItem('truthlens_model', newSettings.model)
    localStorage.setItem('truthlens_temperature', String(newSettings.temperature))

    setSettingsApiKey(newSettings.apiKey)
    setSettingsModel(newSettings.model)
    setSettingsTemperature(newSettings.temperature)
  }

  function handleResetSettings() {
    localStorage.removeItem('truthlens_api_key')
    localStorage.removeItem('truthlens_model')
    localStorage.removeItem('truthlens_temperature')

    setSettingsApiKey(getEffectiveApiKey() ?? '')
    setSettingsModel(DEFAULT_MODEL)
    setSettingsTemperature(DEFAULT_TEMPERATURE)
  }

  return (
    <div className="layout-root">
      <BackgroundLayer />

      {/* ── Sidebar ── */}
      <Sidebar
        agents={agents}
        hasKey={hasApiKey}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
      />

      {/* ── Main Content ── */}
      <main className="main-content relative z-10">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          {/* ── HISTORY VIEW ── */}
          {currentTab === 'history' && (
            <HistoryView
              history={history}
              onSelect={handleSelectHistoryItem}
              onClear={handleClearHistory}
              onDelete={handleDeleteHistoryItem}
              onBackToDashboard={() => setCurrentTab('dashboard')}
            />
          )}

          {/* ── SETTINGS VIEW ── */}
          {currentTab === 'settings' && (
            <SettingsView
              apiKey={settingsApiKey}
              model={settingsModel}
              temperature={settingsTemperature}
              onSave={handleSaveSettings}
              onReset={handleResetSettings}
              onBackToDashboard={() => setCurrentTab('dashboard')}
            />
          )}

          {/* ── DASHBOARD VIEW ── */}
          {currentTab === 'dashboard' && (
            <>
              {/* ── Page Header ── */}
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: '#4f8ef7',
                      boxShadow: '0 0 8px #4f8ef7',
                      animation: 'glowPulse 2s ease-in-out infinite',
                    }}
                  />
                  <span className="font-mono text-[11px] tracking-[0.3em] text-tl-muted uppercase">
                    Autonomous Verification Pipeline
                  </span>
                </div>
                <h1 className="font-display text-3xl font-bold text-white mb-1">
                  Claim <span style={{ color: '#4f8ef7' }}>Analysis</span>
                </h1>
                <p className="font-sans text-sm text-tl-muted">
                  Submit a claim, URL, or image — three AI agents interrogate and return a truth verdict.
                </p>
              </motion.div>

              {/* ── Toasts ── */}
              <AnimatePresence>
                {!hasApiKey && !keyDismissed && (
                  <KeyWarningToast
                    onDismiss={() => setKeyDismissed(true)}
                    onOpenSettings={() => setCurrentTab('settings')}
                  />
                )}
                {error && (
                  <ErrorToast message={error} onDismiss={() => setError(null)} />
                )}
              </AnimatePresence>

              {/* ── Input Section ── */}
              <InputSection
                busy={busy}
                onOcrError={setError}
                onAnalyze={analyze}
              />

              {/* ── Agent Pipeline ── */}
              <AgentPipeline agents={agents} />

              {/* ── Results ── */}
              {result && !busy && (
                <ResultsDashboard
                  result={result.verdict}
                  oracle={result.oracle}
                  sources={result.sentinel.sources}
                />
              )}

              {/* ── Idle footer ── */}
              {!busy && !result && !error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-12 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.2em] text-tl-muted/50 uppercase"
                >
                  <span
                    style={{
                      display: 'inline-block',
                      animation: 'spin 8s linear infinite',
                    }}
                  >
                    ◈
                  </span>
                  awaiting input · three agents stand ready
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App