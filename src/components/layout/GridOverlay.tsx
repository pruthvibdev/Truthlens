import { motion } from 'framer-motion'
import { BarChart3, Clock, Eye, KeyRound, Radar, ScanSearch, Scale, Settings, ShieldCheck } from 'lucide-react'
import type { AgentId, AgentState } from '../../types'

/** Soft dot-pattern + ambient gradient background */
export default function BackgroundLayer() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Radial ambient glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 30% 0%, rgba(79,142,247,0.08) 0%, transparent 60%),' +
            'radial-gradient(ellipse 60% 50% at 80% 80%, rgba(129,140,248,0.06) 0%, transparent 55%),' +
            '#080c14',
        }}
      />
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(79,142,247,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 20%, transparent 80%)',
        }}
      />
    </div>
  )
}

const AGENT_ICONS: Record<AgentId, typeof Eye> = {
  oracle: Eye,
  sentinel: ScanSearch,
  verdict: Scale,
}

const AGENT_COLORS: Record<AgentId, string> = {
  oracle: '#4f8ef7',
  sentinel: '#34d399',
  verdict: '#fb923c',
}

const AGENT_LABELS: Record<AgentId, string> = {
  oracle: 'ORACLE',
  sentinel: 'SENTINEL',
  verdict: 'VERDICT',
}

const STATUS_COLOR: Record<string, string> = {
  idle: '#64748b',
  processing: '#4f8ef7',
  done: '#34d399',
  error: '#f87171',
}

function AgentStatusDot({ agent }: { agent: AgentState }) {
  const Icon = AGENT_ICONS[agent.id]
  const color = AGENT_COLORS[agent.id]
  const dotColor = STATUS_COLOR[agent.status]
  const isProcessing = agent.status === 'processing'

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-default">
      <Icon size={13} style={{ color }} />
      <span className="font-mono text-[11px] tracking-widest text-tl-text-dim flex-1 uppercase">
        {AGENT_LABELS[agent.id]}
      </span>
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${isProcessing ? 'animate-pulse' : ''}`}
        style={{ background: dotColor, boxShadow: isProcessing ? `0 0 6px ${dotColor}` : 'none' }}
      />
    </div>
  )
}

export type TabId = 'dashboard' | 'history' | 'settings'

const NAV_ITEMS: { id: TabId; icon: typeof BarChart3; label: string }[] = [
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
  { id: 'history', icon: Clock, label: 'History' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  agents: AgentState[]
  hasKey: boolean
  currentTab?: TabId
  onSelectTab?: (tab: TabId) => void
}

export function Sidebar({ agents, hasKey, currentTab = 'dashboard', onSelectTab }: SidebarProps) {
  return (
    <motion.aside
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sidebar"
    >
      {/* ── Logo ── */}
      <div
        className="px-4 pt-6 pb-4 cursor-pointer"
        onClick={() => onSelectTab?.('dashboard')}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
            style={{
              background: 'linear-gradient(135deg, #4f8ef7 0%, #818cf8 100%)',
              boxShadow: '0 0 16px rgba(79,142,247,0.4)',
            }}
          >
            <Radar size={16} className="text-white" />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-tight text-white">
              Truth<span style={{ color: '#4f8ef7' }}>Lens</span>
            </div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-tl-muted uppercase">
              v1.0 · Groq
            </div>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 h-px bg-tl-line" />

      {/* ── Navigation ── */}
      <nav className="px-2 pt-4 pb-2">
        <div className="mb-1 px-3 font-mono text-[9px] tracking-[0.25em] text-tl-muted uppercase">
          Navigation
        </div>
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const active = currentTab === id
          return (
            <button
              key={id}
              onClick={() => onSelectTab?.(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 font-sans text-sm transition-all text-left cursor-pointer ${
                active
                  ? 'bg-tl-blue/10 text-tl-blue border border-tl-blue/20'
                  : 'text-tl-muted hover:bg-white/5 hover:text-tl-text border border-transparent'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* ── Divider ── */}
      <div className="mx-4 h-px bg-tl-line" />

      {/* ── Agent Status ── */}
      <div className="px-2 pt-4 pb-2">
        <div className="mb-1 px-3 font-mono text-[9px] tracking-[0.25em] text-tl-muted uppercase">
          Agent Status
        </div>
        {agents.map((agent) => (
          <AgentStatusDot key={agent.id} agent={agent} />
        ))}
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Bottom: API key status ── */}
      <div className="px-4 pb-6">
        <div
          onClick={() => onSelectTab?.('settings')}
          className={`flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer hover:opacity-90 transition-opacity ${
            hasKey
              ? 'bg-tl-green/10 border border-tl-green/20'
              : 'bg-tl-orange/10 border border-tl-orange/20'
          }`}
          title="Click to configure API Settings"
        >
          {hasKey ? (
            <ShieldCheck size={13} className="text-tl-green shrink-0" />
          ) : (
            <KeyRound size={13} className="text-tl-orange shrink-0" />
          )}
          <div>
            <div
              className={`font-mono text-[10px] font-bold tracking-widest uppercase ${hasKey ? 'text-tl-green' : 'text-tl-orange'}`}
            >
              {hasKey ? 'API Connected' : 'Key Missing'}
            </div>
            <div className="font-mono text-[9px] text-tl-muted">
              {hasKey ? 'Groq powered' : 'Click to configure'}
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  )
}

export function Scanline() {
  return (
    <div
      className="absolute inset-x-0 top-0 h-8 pointer-events-none"
      style={{
        background:
          'linear-gradient(to bottom, transparent, rgba(79,142,247,0.25), transparent)',
        animation: 'scanline 2.8s linear infinite',
      }}
    />
  )
}