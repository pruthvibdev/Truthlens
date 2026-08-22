import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Image as ImageIcon, Link2, Send, Sparkles, X, Upload } from 'lucide-react'
import type { InputMode } from '../../types'

interface Props {
  busy: boolean
  onAnalyze: (input: { mode: InputMode; text: string }) => void
  onOcrError: (message: string) => void
}

const MODES: { id: InputMode; label: string; icon: typeof FileText; description: string }[] = [
  { id: 'text', label: 'Text', icon: FileText, description: 'Paste a claim or headline' },
  { id: 'url', label: 'URL', icon: Link2, description: 'Analyze a web article' },
  { id: 'image', label: 'Image', icon: ImageIcon, description: 'Upload a screenshot' },
]

export default function InputSection({ busy, onAnalyze, onOcrError }: Props) {
  const [mode, setMode] = useState<InputMode>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [image, setImage] = useState<{ name: string; dataUrl: string } | null>(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      onOcrError('Selected file is not an image')
      return
    }
    setOcrBusy(true)
    const reader = new FileReader()
    reader.onload = async () => {
      setImage({ name: file.name, dataUrl: reader.result as string })
      setOcrBusy(false)
    }
    reader.readAsDataURL(file)
  }

  const analyzeable =
    (mode === 'text' && text.trim().length > 5) ||
    (mode === 'url' && /^https?:\/\/.+\..+/.test(url.trim())) ||
    (mode === 'image' && image !== null)

  async function submit() {
    if (!analyzeable || busy) return
    if (mode === 'text') onAnalyze({ mode, text: text.trim() })
    if (mode === 'url') onAnalyze({ mode, text: url.trim() })
    if (mode === 'image' && image) {
      onAnalyze({ mode, text: image.dataUrl })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      submit()
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass-card p-5 mb-6"
    >
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-white">Submit Claim</h2>
          <p className="font-sans text-xs text-tl-muted mt-0.5">Choose input type and enter your content</p>
        </div>
        {/* Mode tabs — pill style */}
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ background: 'rgba(26,35,64,0.8)', border: '1px solid #1a2340' }}
        >
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`mode-tab-${id}`}
              disabled={busy}
              onClick={() => setMode(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-sans text-xs font-medium transition-all disabled:opacity-50 ${
                mode === id
                  ? 'text-white'
                  : 'text-tl-muted hover:text-tl-text'
              }`}
              style={
                mode === id
                  ? {
                      background: 'linear-gradient(135deg, rgba(79,142,247,0.25) 0%, rgba(129,140,248,0.15) 100%)',
                      border: '1px solid rgba(79,142,247,0.35)',
                      boxShadow: '0 0 12px rgba(79,142,247,0.15)',
                    }
                  : { border: '1px solid transparent' }
              }
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input fields ── */}
      <AnimatePresence mode="wait">
        {mode === 'text' && (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <textarea
              id="claim-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste a claim, rumor, headline, or statement to verify…"
              className="h-36 w-full resize-none rounded-xl p-4 font-mono text-sm text-tl-text placeholder:text-tl-muted/50 focus:outline-none transition-all"
              style={{
                background: 'rgba(8,12,20,0.8)',
                border: '1px solid #1a2340',
                ...(text ? { borderColor: 'rgba(79,142,247,0.4)', boxShadow: '0 0 16px rgba(79,142,247,0.06)' } : {}),
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(79,142,247,0.5)'
                e.currentTarget.style.boxShadow = '0 0 20px rgba(79,142,247,0.08)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = text ? 'rgba(79,142,247,0.4)' : '#1a2340'
                e.currentTarget.style.boxShadow = text ? '0 0 16px rgba(79,142,247,0.06)' : 'none'
              }}
            />
            <div className="mt-1.5 flex justify-between">
              <span className="font-mono text-[10px] text-tl-muted/60">
                {text.length > 0 ? `${text.length} chars` : 'Ctrl+Enter to analyze'}
              </span>
              {text.length > 0 && (
                <button
                  onClick={() => setText('')}
                  className="font-mono text-[10px] text-tl-muted hover:text-tl-red transition-colors flex items-center gap-1"
                >
                  <X size={10} /> Clear
                </button>
              )}
            </div>
          </motion.div>
        )}

        {mode === 'url' && (
          <motion.div
            key="url"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <div className="relative">
              <Link2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-tl-muted" />
              <input
                id="url-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="https://example.com/article…"
                className="w-full rounded-xl pl-10 pr-4 py-3.5 font-mono text-sm text-tl-text placeholder:text-tl-muted/50 focus:outline-none transition-all"
                style={{
                  background: 'rgba(8,12,20,0.8)',
                  border: '1px solid #1a2340',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(79,142,247,0.5)'
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(79,142,247,0.08)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#1a2340'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-tl-muted/60">
              Article content will be fetched and analyzed
            </p>
          </motion.div>
        )}

        {mode === 'image' && (
          <motion.div
            key="image"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <div
              id="image-dropzone"
              className={`relative flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all ${
                isDragging
                  ? 'border-tl-blue/70 bg-tl-blue/8'
                  : 'border-tl-line hover:border-tl-blue/40'
              }`}
              style={{ background: 'rgba(8,12,20,0.6)', ...(isDragging ? { background: 'rgba(79,142,247,0.05)' } : {}) }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files[0]
                if (file) handleFile(file)
              }}
            >
              {ocrBusy ? (
                <>
                  <Sparkles size={22} className="text-tl-blue" style={{ animation: 'spin 1s linear infinite' }} />
                  <span className="font-mono text-xs text-tl-muted">Processing image…</span>
                </>
              ) : image ? (
                <>
                  <img src={image.dataUrl} alt="" className="max-h-20 rounded-lg border border-tl-line object-contain" />
                  <span className="font-mono text-[10px] text-tl-muted">{image.name}</span>
                </>
              ) : (
                <>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)' }}
                  >
                    <Upload size={18} className="text-tl-blue" />
                  </div>
                  <div className="text-center">
                    <div className="font-sans text-xs font-medium text-tl-text">
                      Drop image here or <span className="text-tl-blue">browse</span>
                    </div>
                    <div className="font-mono text-[10px] text-tl-muted mt-0.5">PNG, JPG, WEBP supported</div>
                  </div>
                </>
              )}
            </div>
            {image && (
              <button
                onClick={() => setImage(null)}
                className="mt-2 flex items-center gap-1 font-mono text-[11px] text-tl-red hover:text-tl-red/70 transition-colors"
              >
                <X size={11} /> Remove image
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {/* ── Submit Button ── */}
      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[10px] text-tl-muted/60">
          {busy ? 'Analysis in progress…' : analyzeable ? 'Ready to analyze' : 'Enter content above'}
        </span>
        <button
          id="analyze-submit-btn"
          onClick={submit}
          disabled={!analyzeable || busy || ocrBusy}
          className="relative flex items-center gap-2.5 rounded-xl px-6 py-2.5 font-sans text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-30 overflow-hidden"
          style={{
            background: analyzeable && !busy
              ? 'linear-gradient(135deg, #4f8ef7 0%, #818cf8 100%)'
              : 'rgba(79,142,247,0.3)',
            boxShadow: analyzeable && !busy ? '0 0 24px rgba(79,142,247,0.35)' : 'none',
          }}
        >
          {/* Shimmer overlay on hover */}
          <span
            className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white" style={{ animation: 'spin 0.7s linear infinite' }} />
              Analyzing…
            </>
          ) : (
            <>
              <Send size={14} />
              Analyze Claim
            </>
          )}
        </button>
      </div>
    </motion.section>
  )
}