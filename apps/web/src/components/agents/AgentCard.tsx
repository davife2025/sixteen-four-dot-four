'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/agents/AgentCard.tsx
// Agent card — shows status, P&L, type badge
// Start / Stop toggle calls PATCH /api/agents/:id
// ============================================================

import { useState } from 'react'

interface Agent {
  id: string
  name: string
  type: string
  status: string
  wallet_address: string
  eip8004_token_id: string | null
  leaderboard?: Array<{ total_pnl_bnb: number; tokens_created: number; trades_executed: number }>
  agent_earnings?: Array<{ claimable_bnb: number }>
}

interface Props { agent: Agent }

const TYPE_COLORS: Record<string, string> = {
  creator: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  trader:  'bg-teal-500/10 text-teal-400 border-teal-500/20',
  hybrid:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500',
  idle:    'bg-gray-500',
  paused:  'bg-yellow-500',
  error:   'bg-red-500',
}

export function AgentCard({ agent }: Props) {
  const [status, setStatus] = useState(agent.status)
  const [loading, setLoading] = useState(false)

  const lb    = agent.leaderboard?.[0]
  const pnl   = lb?.total_pnl_bnb ?? 0
  const claimable = (agent.agent_earnings ?? []).reduce((s, e) => s + e.claimable_bnb, 0)

  async function toggleStatus() {
    const next = status === 'running' ? 'idle' : 'running'
    setLoading(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) setStatus(next)
    } catch (err) {
      console.error('Failed to toggle agent status:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5 space-y-4 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-500'}`} />
            <h3 className="font-semibold text-white truncate">{agent.name}</h3>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">
            {agent.wallet_address.slice(0, 10)}…{agent.wallet_address.slice(-6)}
          </p>
        </div>
        <span className={`shrink-0 text-xs px-2 py-1 rounded-full border font-medium ${TYPE_COLORS[agent.type] ?? ''}`}>
          {agent.type}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className={`text-lg font-bold tabular-nums ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(3)}
          </p>
          <p className="text-xs text-gray-500">BNB P&L</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white tabular-nums">{lb?.tokens_created ?? 0}</p>
          <p className="text-xs text-gray-500">created</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white tabular-nums">{lb?.trades_executed ?? 0}</p>
          <p className="text-xs text-gray-500">trades</p>
        </div>
      </div>

      {/* EIP-8004 badge */}
      {agent.eip8004_token_id && (
        <div className="flex items-center gap-1.5 text-xs text-teal-400">
          <span>✓</span>
          <span>EIP-8004 registered — Insider Phase access</span>
        </div>
      )}

      {/* Claimable */}
      {claimable > 0 && (
        <div className="flex items-center justify-between text-sm bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
          <span className="text-gray-400">Claimable royalties</span>
          <span className="font-semibold text-green-400">{claimable.toFixed(4)} BNB</span>
        </div>
      )}

      {/* Start / Stop */}
      <button
        onClick={toggleStatus}
        disabled={loading || status === 'error'}
        className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
          status === 'running'
            ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
            : 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20 hover:bg-brand-purple/20'
        }`}
      >
        {loading ? 'Updating…' : status === 'running' ? 'Stop Agent' : 'Start Agent'}
      </button>
    </div>
  )
}
