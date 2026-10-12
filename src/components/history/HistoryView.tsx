import { motion } from 'framer-motion'
import { Clock, Trash2, ArrowUpRight, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import type { AnalysisResult } from '../../types'
import { verdictColor } from '../../types'

export interface HistoryItem {
  id: string
  timestamp: number
  inputMode: string
  claim: string
  result: AnalysisResult
}

interface Props {
  history: HistoryItem[]
  onSelect: (item: HistoryItem) => void
  onClear: () => void
  onDelete: (id: string) => void
  onBackToDashboard: () => void
}

function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case 'TRUE':
    case 'MOSTLY TRUE':
      return CheckCircle2
    case 'PARTIALLY TRUE':
      return AlertTriangle
    case 'MOSTLY FALSE':
    case 'FALSE':
      return XCircle
    default:
      return HelpCircle
  }
}

export default function HistoryView({
  history,
  onSelect,
  onClear,
  onDelete,
  onBackToDashboard,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* ── Top bar ── */}
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
              <Clock size={20} className="text-tl-blue" />
              Verification History
            </h2>
            <p className="font-sans text-xs text-tl-muted">
              {history.length} {history.length === 1 ? 'record' : 'records'} saved locally
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-tl-red/30 bg-tl-red/10 text-tl-red hover:bg-tl-red/20 font-mono text-xs transition-colors"
          >
            <Trash2 size={13} />
            Clear All
          </button>
        )}
      </div>

      {/* ── Empty State ── */}
      {history.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-tl-line mb-4 text-tl-muted">
            <Clock size={24} />
          </div>
          <h3 className="font-sans text-base font-semibold text-white mb-1">No claims verified yet</h3>
          <p className="font-sans text-xs text-tl-muted max-w-sm mb-6">
            Run a verification on the dashboard to build your audit history.
          </p>
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tl-blue/20 border border-tl-blue/40 text-tl-blue hover:bg-tl-blue/30 font-sans text-xs font-semibold transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      ) : (
        /* ── History List ── */
        <div className="flex flex-col gap-3">
          {history.map((item) => {
            const color = verdictColor(item.result.verdict.score)
            const VerdictIcon = getVerdictIcon(item.result.verdict.verdict)
            const dateStr = new Date(item.timestamp).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <motion.div
                key={item.id}
                layout
                className="group glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-tl-blue/40 transition-all cursor-pointer"
                onClick={() => onSelect(item)}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Score badge */}
                  <div
                    className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-display font-bold text-base leading-none"
                    style={{
                      background: `${color}15`,
                      color: color,
                      border: `1px solid ${color}35`,
                      boxShadow: `0 0 14px ${color}15`,
                    }}
                  >
                    <span>{item.result.verdict.score}</span>
                    <span className="font-mono text-[8px] tracking-wider opacity-75 mt-0.5">SCORE</span>
                  </div>

                  {/* Claim and metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          color,
                          background: `${color}10`,
                          border: `1px solid ${color}30`,
                        }}
                      >
                        <VerdictIcon size={11} />
                        {item.result.verdict.verdict}
                      </span>
                      <span className="font-mono text-[10px] text-tl-muted/60">
                        {dateStr}
                      </span>
                      <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-tl-muted">
                        {item.inputMode}
                      </span>
                    </div>

                    <p className="font-sans text-sm text-tl-text font-medium line-clamp-2 leading-snug group-hover:text-white transition-colors">
                      {item.claim || item.result.oracle.claim}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                    className="p-2 text-tl-muted hover:text-tl-red hover:bg-tl-red/10 rounded-lg transition-all"
                    title="Delete item"
                  >
                    <Trash2 size={15} />
                  </button>

                  <div className="flex items-center gap-1 font-sans text-xs font-medium text-tl-blue group-hover:translate-x-0.5 transition-transform">
                    <span>View</span>
                    <ArrowUpRight size={14} />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
