import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, CircleDashed, Eye, ScanSearch, Scale, XCircle } from 'lucide-react'
import type { AgentId, AgentState } from '../../types'

const AGENT_META: Record<
  AgentId,
  { name: string; role: string; accent: string; icon: typeof Scale; description: string }
> = {
  oracle: {
    name: 'ORACLE',
    role: 'Claim Extraction',
    accent: '#4f8ef7',
    icon: Eye,
    description: 'Extracts and structures the core claim for analysis',
  },
  sentinel: {
    name: 'SENTINEL',
    role: 'Web Grounding',
    accent: '#34d399',
    icon: ScanSearch,
    description: 'Cross-references claim against live web sources',
  },
  verdict: {
    name: 'VERDICT',
    role: 'Adjudication',
    accent: '#fb923c',
    icon: Scale,
    description: 'Scores the claim and issues a final truth verdict',
  },
}

function StatusBadge({ status, accent }: { status: AgentState['status']; accent: string }) {
  const config = {
    idle: { label: 'Standby', color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' },
    processing: { label: 'Processing', color: accent, bg: `${accent}18`, border: `${accent}40` },
    done: { label: 'Complete', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' },
    error: { label: 'Error', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
  }[status]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === 'processing' ? 'animate-pulse' : ''}`}
        style={{ background: config.color, boxShadow: status === 'processing' ? `0 0 6px ${config.color}` : 'none' }}
      />
      {config.label}
    </span>
  )
}

function AgentCard({ agent, index }: { agent: AgentState; index: number }) {
  const meta = AGENT_META[agent.id]
  const Icon = meta.icon
  const active = agent.status === 'processing'
  const done = agent.status === 'done'
  const error = agent.status === 'error'
  const logBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = logBoxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [agent.logs])

  // Elapsed time display
  const elapsed =
    done && agent.startedAt && agent.finishedAt
      ? `${((agent.finishedAt - agent.startedAt) / 1000).toFixed(1)}s`
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="relative overflow-hidden rounded-2xl flex flex-col"
      style={{
        background: active
          ? `linear-gradient(135deg, rgba(15,25,50,0.95) 0%, rgba(11,19,38,0.98) 100%)`
          : 'linear-gradient(135deg, rgba(13,19,38,0.8) 0%, rgba(10,15,30,0.9) 100%)',
        border: active
          ? `1px solid ${meta.accent}50`
          : done
          ? '1px solid rgba(52,211,153,0.2)'
          : error
          ? '1px solid rgba(248,113,113,0.2)'
          : '1px solid #1a2340',
        boxShadow: active ? `0 0 32px ${meta.accent}15` : 'none',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        opacity: agent.status === 'idle' ? 0.7 : 1,
      }}
    >
      {/* Active glow shimmer */}
      {active && (
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${meta.accent}, transparent)`,
            animation: 'shimmer 2s linear infinite',
          }}
        />
      )}

      {/* ── Card Header ── */}
      <div
        className="flex items-start justify-between p-4 pb-3"
        style={{ borderBottom: '1px solid rgba(26,35,64,0.6)' }}
      >
        <div className="flex items-center gap-3">
          {/* Icon box */}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
            style={{
              background: active
                ? `linear-gradient(135deg, ${meta.accent}30 0%, ${meta.accent}15 100%)`
                : 'rgba(26,35,64,0.6)',
              border: `1px solid ${active ? `${meta.accent}40` : '#1a2340'}`,
              boxShadow: active ? `0 0 16px ${meta.accent}25` : 'none',
            }}
          >
            <Icon size={16} style={{ color: active ? meta.accent : done ? '#34d399' : '#64748b' }} />
          </div>
          <div>
            <div
              className="font-display text-sm font-bold tracking-wide"
              style={{ color: active ? meta.accent : done ? '#e2e8f0' : '#94a3b8' }}
            >
              {meta.name}
            </div>
            <div className="font-sans text-[10px] text-tl-muted">{meta.role}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {elapsed && (
            <span className="font-mono text-[9px] text-tl-muted/60">{elapsed}</span>
          )}
          {done && <CheckCircle2 size={15} style={{ color: '#34d399', filter: 'drop-shadow(0 0 6px #34d399)' }} />}
          {error && <XCircle size={15} className="text-tl-red" />}
          {agent.status === 'idle' && <CircleDashed size={15} className="text-tl-muted/40" />}
          {active && <StatusBadge status={agent.status} accent={meta.accent} />}
        </div>
      </div>

      {/* ── Description (only when idle) ── */}
      {agent.status === 'idle' && (
        <div className="px-4 py-2.5">
          <p className="font-sans text-[11px] text-tl-muted/70 leading-relaxed">{meta.description}</p>
        </div>
      )}

      {/* ── Log Terminal ── */}
      {(active || done || error) && (
        <div
          ref={logBoxRef}
          className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[10px] leading-relaxed"
          style={{
            minHeight: '80px',
            maxHeight: '120px',
            background: 'rgba(6,9,14,0.6)',
          }}
        >
          {agent.logs.length === 0 ? (
            <span className="text-tl-muted/40">// initializing…</span>
          ) : (
            agent.logs.map((line, i) => (
              <div
                key={`${i}:${line.slice(0, 20)}`}
                className={line.startsWith('⚠') ? 'text-tl-orange' : 'text-tl-muted'}
              >
                <span style={{ color: meta.accent }}>{`> `}</span>
                {line}
              </div>
            ))
          )}
          {active && (
            <span style={{ color: meta.accent, animation: 'blink 1s step-end infinite' }}>▌</span>
          )}
        </div>
      )}
    </motion.div>
  )
}

export default function AgentPipeline({ agents }: { agents: AgentState[] }) {
  const anyActive = agents.some((a) => a.status !== 'idle')

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mb-6"
    >
      {anyActive && (
        <div className="mb-3 flex items-center gap-2">
          <div className="font-sans text-xs font-semibold text-white">Agent Pipeline</div>
          <div className="flex-1 h-px bg-tl-line" />
          <div className="font-mono text-[10px] text-tl-muted">
            {agents.filter((a) => a.status === 'done').length}/{agents.length} complete
          </div>
        </div>
      )}

      {/* 3-column grid, collapses to 1-col on mobile */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {agents.map((a, i) => (
          <AgentCard key={a.id} agent={a} index={i} />
        ))}
      </div>

      {/* Pipeline connector line (decorative, desktop only) */}
      {anyActive && (
        <div className="hidden sm:flex items-center justify-center mt-1 px-[calc(33.33%/2)]">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, #1a2340, transparent)' }} />
        </div>
      )}
    </motion.section>
  )
}