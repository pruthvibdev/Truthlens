import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, TrendingUp, FileText, AlertTriangle, BookOpen } from 'lucide-react'
import type { OracleResult, SourceRef, VerdictResult } from '../../types'
import { verdictColor } from '../../types'

/** Animated semi-circle gauge — NeuroBank style */
function TruthGauge({ score, color }: { score: number; color: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame = 0
    const total = 1600
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / total)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * score))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [score])

  const r = 80
  const arc = Math.PI
  const length = r * arc
  const filled = (display / 100) * length

  // Gauge track endpoints (semicircle from left to right, opening downward)
  const cx = 110
  const cy = 105
  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  return (
    <div className="relative flex flex-col items-center">
      <svg width="220" height="120" viewBox="0 0 220 120" aria-label={`Truth score: ${display}%`}>
        {/* Track */}
        <path
          d={pathD}
          fill="none"
          stroke="#1a2340"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          style={{
            strokeDasharray: `${length}`,
            strokeDashoffset: `${length - filled}`,
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
        {/* Score number */}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="36"
          fontWeight="700"
          fontFamily="Space Grotesk, sans-serif"
        >
          {display}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill="#64748b"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="2"
        >
          TRUTH SCORE
        </text>
      </svg>

      {/* Min / Max labels */}
      <div className="flex w-full justify-between px-4 -mt-2 font-mono text-[9px] text-tl-muted/60">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  )
}

function SourceCard({ title, url, domain }: { title: string; url: string; domain: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-xl p-3 transition-all hover:-translate-y-0.5"
      style={{
        background: 'rgba(15,25,50,0.6)',
        border: '1px solid #1a2340',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(79,142,247,0.35)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,142,247,0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#1a2340'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Domain favicon placeholder */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5 font-mono text-[9px] font-bold text-white uppercase"
        style={{ background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.2)' }}
      >
        {domain.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-xs font-medium text-tl-text group-hover:text-tl-blue transition-colors">
          {title}
        </div>
        <div className="truncate font-mono text-[9px] text-tl-muted mt-0.5">{domain}</div>
      </div>
      <ExternalLink size={11} className="text-tl-muted/40 group-hover:text-tl-blue transition-colors shrink-0 mt-0.5" />
    </a>
  )
}

interface ResultsDashboardProps {
  result: VerdictResult
  oracle?: OracleResult
  sources?: SourceRef[]
}

export default function ResultsDashboard({
  result,
  oracle,
  sources = [],
}: ResultsDashboardProps) {
  const color = verdictColor(result.score)

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mt-2"
    >
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp size={13} style={{ color }} />
        <div className="font-sans text-xs font-semibold text-white">Analysis Results</div>
        <div className="flex-1 h-px bg-tl-line" />
        <div
          className="rounded-full px-3 py-0.5 font-mono text-[10px] font-bold tracking-[0.25em] uppercase"
          style={{
            color,
            background: `${color}12`,
            border: `1px solid ${color}40`,
            boxShadow: `0 0 12px ${color}25`,
          }}
        >
          {result.verdict}
        </div>
      </div>

      {/* ── Top row: Gauge + Explanation ── */}
      <div
        className="glass-card p-6 mb-4"
        style={{ boxShadow: `0 0 40px ${color}10` }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Gauge */}
          <div className="shrink-0">
            <TruthGauge score={result.score} color={color} />
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px self-stretch bg-tl-line" />

          {/* Explanation */}
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <FileText size={12} className="text-tl-muted" />
              <span className="font-mono text-[10px] tracking-[0.2em] text-tl-muted uppercase">
                AI Verdict
              </span>
            </div>
            <p className="font-sans text-sm leading-relaxed text-tl-text">
              {result.explanation}
            </p>

            {/* Claim extracted by oracle */}
            {oracle?.claim && (
              <div
                className="mt-4 rounded-xl px-4 py-3"
                style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}
              >
                <div className="mb-1 font-mono text-[9px] tracking-[0.2em] text-tl-blue/70 uppercase">
                  Analyzed Claim
                </div>
                <p className="font-sans text-xs text-tl-text-dim leading-relaxed italic">
                  "{oracle.claim}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Corrections ── */}
      {result.corrections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-4 rounded-2xl p-4"
          style={{
            background: 'rgba(251,146,60,0.06)',
            border: '1px solid rgba(251,146,60,0.25)',
            borderLeft: '3px solid #fb923c',
          }}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <AlertTriangle size={13} className="text-tl-orange" />
            <span className="font-mono text-[10px] font-bold tracking-[0.25em] text-tl-orange uppercase">
              Corrections & Clarifications
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {result.corrections.map((c, i) => (
              <li key={i} className="flex items-start gap-2 font-sans text-xs text-tl-text leading-relaxed">
                <span className="text-tl-orange/60 shrink-0 mt-0.5">→</span>
                {c}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* ── Sources ── */}
      {sources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <BookOpen size={12} className="text-tl-muted" />
            <span className="font-mono text-[10px] font-bold tracking-[0.25em] text-tl-muted uppercase">
              Verified Sources
            </span>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[9px] text-tl-blue"
              style={{ background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)' }}
            >
              {sources.length}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {sources.map((s, i) => (
              <SourceCard key={`${s.url}-${i}`} {...s} />
            ))}
          </div>
        </motion.div>
      )}
    </motion.section>
  )
}