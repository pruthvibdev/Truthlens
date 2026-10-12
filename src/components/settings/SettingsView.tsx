import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  KeyRound,
  Cpu,
  Sliders,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Terminal,
} from 'lucide-react'
import { testConnection } from '../../services/gemini'
import { isBackendAvailable, BACKEND_URL } from '../../services/backend'

const AVAILABLE_MODELS = [
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B (Recommended)',
    desc: 'Highest reasoning capability and evidence synthesis quality.',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B (Fast)',
    desc: 'Ultra-low latency inference, best for fast checks.',
  },
  {
    id: 'groq/compound',
    name: 'Groq Compound',
    desc: 'Multi-agent orchestration model on Groq.',
  },
  {
    id: 'groq/compound-mini',
    name: 'Groq Compound Mini',
    desc: 'Lightweight compound reasoning model.',
  },
]

interface Props {
  apiKey: string
  model: string
  temperature: number
  onSave: (settings: { apiKey: string; model: string; temperature: number }) => void
  onReset: () => void
  onBackToDashboard: () => void
}

export default function SettingsView({
  apiKey: initialApiKey,
  model: initialModel,
  temperature: initialTemperature,
  onSave,
  onReset,
  onBackToDashboard,
}: Props) {
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [model, setModel] = useState(initialModel)
  const [temperature, setTemperature] = useState(initialTemperature)
  const [showKey, setShowKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    latency?: number
  } | null>(null)

  const [checkingBackend, setCheckingBackend] = useState(false)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

  async function handleCheckBackend() {
    setCheckingBackend(true)
    const online = await isBackendAvailable()
    setBackendOnline(online)
    setCheckingBackend(false)
  }

  function handleSave() {
    onSave({ apiKey: apiKey.trim(), model, temperature })
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

  async function handleTestPing() {
    setTesting(true)
    setTestResult(null)
    const res = await testConnection(apiKey.trim() || undefined, model)
    setTesting(false)
    setTestResult(res)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-tl-line text-tl-muted hover:text-white hover:border-tl-blue/40 transition-all"
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2.5">
              <Settings size={20} className="text-tl-blue" />
              Pipeline Settings
            </h2>
            <p className="font-sans text-xs text-tl-muted">
              Configure Groq API key, model selection, and inference parameters
            </p>
          </div>
        </div>

        <button
          onClick={onReset}
          className="font-mono text-xs text-tl-muted hover:text-tl-red px-3 py-1.5 rounded-lg border border-transparent hover:border-tl-red/30 transition-all"
        >
          Reset Defaults
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {/* ── API Key Configuration ── */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-tl-blue" />
              <h3 className="font-display text-sm font-semibold text-white">Groq API Key</h3>
            </div>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-[11px] text-tl-blue hover:text-tl-blue-light transition-colors"
            >
              Get Free Key <ExternalLink size={11} />
            </a>
          </div>

          <p className="font-sans text-xs text-tl-muted mb-3 leading-relaxed">
            TruthLens runs directly on Groq's high-speed LPU inference engine. You can use the key configured in{' '}
            <code className="text-tl-blue bg-tl-blue/10 px-1 rounded font-mono">.env.local</code> or override it below.
          </p>

          <div className="relative mb-3">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full rounded-xl bg-tl-bg/80 border border-tl-line pl-4 pr-24 py-3 font-mono text-xs text-tl-text focus:outline-none focus:border-tl-blue/50 transition-all"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 text-tl-muted hover:text-tl-text transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={handleTestPing}
              disabled={testing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-tl-line hover:border-tl-blue/40 text-tl-text text-xs font-sans font-medium transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={testing ? 'animate-spin text-tl-blue' : ''} />
              {testing ? 'Pinging API...' : 'Test Connection'}
            </button>

            {testResult && (
              <div
                className={`flex items-center gap-1.5 font-mono text-[11px] px-3 py-1 rounded-lg ${
                  testResult.success
                    ? 'bg-tl-green/10 text-tl-green border border-tl-green/30'
                    : 'bg-tl-red/10 text-tl-red border border-tl-red/30'
                }`}
              >
                {testResult.success ? <ShieldCheck size={13} /> : <AlertCircle size={13} />}
                <span>
                  {testResult.message}
                  {testResult.latency !== undefined && ` (${testResult.latency}ms)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Model Selection ── */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={16} className="text-tl-blue" />
            <h3 className="font-display text-sm font-semibold text-white">Inference Model</h3>
          </div>

          <p className="font-sans text-xs text-tl-muted mb-4">
            Select the LLM that powers ORACLE claim extraction, SENTINEL fact synthesis, and VERDICT adjudication.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {AVAILABLE_MODELS.map((m) => {
              const selected = model === m.id
              return (
                <div
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selected
                      ? 'bg-tl-blue/10 border-tl-blue/50 shadow-[0_0_16px_rgba(79,142,247,0.15)]'
                      : 'bg-white/3 border-tl-line hover:border-tl-blue/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans text-xs font-semibold text-white">{m.name}</span>
                    {selected && <Check size={14} className="text-tl-blue" />}
                  </div>
                  <p className="font-sans text-[11px] text-tl-muted leading-relaxed">{m.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Temperature & Creativity ── */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-tl-blue" />
              <h3 className="font-display text-sm font-semibold text-white">Pipeline Temperature</h3>
            </div>
            <span className="font-mono text-xs font-bold text-tl-blue bg-tl-blue/10 px-2 py-0.5 rounded">
              {temperature.toFixed(2)}
            </span>
          </div>

          <p className="font-sans text-xs text-tl-muted mb-4">
            Lower temperature (0.0 – 0.3) ensures strictly factual and reproducible verdicts.
          </p>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-tl-blue cursor-pointer"
          />

          <div className="flex justify-between font-mono text-[10px] text-tl-muted mt-1">
            <span>0.0 (Deterministic)</span>
            <span>0.5 (Balanced)</span>
            <span>1.0 (Creative)</span>
          </div>
        </div>

        {/* ── Python Agent Backend ── */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-tl-blue" />
              <h3 className="font-display text-sm font-semibold text-white">Python Agent Backend</h3>
            </div>
            <span className="font-mono text-[11px] text-tl-muted">
              {BACKEND_URL}
            </span>
          </div>

          <p className="font-sans text-xs text-tl-muted mb-3 leading-relaxed">
            TruthLens includes an optional high-performance Python FastAPI agent backend with DuckDuckGo live web grounding.
            When running (<code className="text-tl-blue bg-tl-blue/10 px-1 rounded font-mono">python run.py</code> in{' '}
            <code className="text-tl-blue bg-tl-blue/10 px-1 rounded font-mono">backend/</code>), TruthLens automatically delegates verification pipeline execution to Python.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              onClick={handleCheckBackend}
              disabled={checkingBackend}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-tl-line hover:border-tl-blue/40 text-tl-text text-xs font-sans font-medium transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={checkingBackend ? 'animate-spin text-tl-blue' : ''} />
              {checkingBackend ? 'Checking...' : 'Check Backend Status'}
            </button>

            {backendOnline !== null && (
              <div
                className={`flex items-center gap-1.5 font-mono text-[11px] px-3 py-1 rounded-lg ${
                  backendOnline
                    ? 'bg-tl-green/10 text-tl-green border border-tl-green/30'
                    : 'bg-white/5 text-tl-muted border border-tl-line'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: backendOnline ? '#34d399' : '#64748b' }}
                />
                {backendOnline ? 'Python Backend Online & Active' : 'Offline (Using browser fallback)'}
              </div>
            )}
          </div>
        </div>

        {/* ── Save Bar ── */}
        <div className="flex items-center justify-between pt-2">
          <span className="font-mono text-xs text-tl-muted">
            {saveSuccess ? '✓ Settings updated successfully' : 'Changes apply immediately to next verification'}
          </span>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-sans text-sm font-semibold text-white shadow-lg transition-all"
            style={{
              background: 'linear-gradient(135deg, #4f8ef7 0%, #818cf8 100%)',
              boxShadow: '0 0 20px rgba(79,142,247,0.35)',
            }}
          >
            <Check size={15} />
            Save Settings
          </button>
        </div>
      </div>
    </motion.div>
  )
}
