'use client'
// ============================================================
// SIXTEEN — apps/web/src/app/logs/page.tsx
// Live agent activity log — shows every Kimi K2 decision
// in real time via Supabase Realtime subscription
// ============================================================

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

interface LogRow {
  id: string
  action: string
  token_address: string | null
  reasoning: string | null
  virality_score: number | null
  amount_bnb: number | null
  outcome: string
  created_at: string
  agents: { name: string; type: string } | null
}

const ACTION_COLORS: Record<string, string> = {
  create:   'text-purple-400 bg-purple-400/10',
  buy:      'text-green-400 bg-green-400/10',
  sell:     'text-red-400 bg-red-400/10',
  skip:     'text-gray-400 bg-gray-400/10',
  register: 'text-teal-400 bg-teal-400/10',
  claim:    'text-amber-400 bg-amber-400/10',
  error:    'text-red-500 bg-red-500/10',
}

const OUTCOME_ICONS: Record<string, string> = {
  success: '✓',
  failed:  '✗',
  skipped: '–',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([])

  useEffect(() => {
    const supabase = createBrowserClient()

    // Initial load
    async function loadLogs() {
      const { data } = await supabase
        .from('agent_logs')
        .select(`
          id, action, token_address, reasoning,
          virality_score, amount_bnb, outcome, created_at,
          agents ( name, type )
        `)
        .order('created_at', { ascending: false })
        .limit(100)
      setLogs((data ?? []) as LogRow[])
    }
    void loadLogs()

    // Realtime subscription
    const channel = supabase
      .channel('logs-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_logs' },
        (payload) => {
          setLogs((prev) => [payload.new as LogRow, ...prev].slice(0, 100))
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Activity Log</h1>
          <p className="text-gray-400 mt-1">
            Every Kimi K2 decision — live. Full transparency on what agents are doing and why.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      </div>

      {/* Log table */}
      <div className="rounded-2xl border border-gray-800 overflow-hidden">
        <div className="grid grid-cols-[auto_auto_auto_1fr_auto_auto] gap-0 text-xs text-gray-500 uppercase tracking-wide px-4 py-2 border-b border-gray-800 bg-gray-900/50">
          <span className="w-20">Time</span>
          <span className="w-24 ml-3">Agent</span>
          <span className="w-16 ml-3">Action</span>
          <span className="ml-3">Reasoning</span>
          <span className="w-16 ml-3 text-right">Amount</span>
          <span className="w-12 ml-3 text-right">Result</span>
        </div>

        {logs.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p>No agent activity yet.</p>
            <p className="text-sm mt-1">Start an agent to see decisions appear here in real time.</p>
          </div>
        )}

        {logs.map((log) => (
          <div
            key={log.id}
            className="grid grid-cols-[auto_auto_auto_1fr_auto_auto] gap-0 items-center px-4 py-3 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors text-sm"
          >
            {/* Time */}
            <span className="w-20 text-gray-600 text-xs font-mono">
              {new Date(log.created_at).toLocaleTimeString()}
            </span>

            {/* Agent name */}
            <span className="w-24 ml-3 text-gray-300 truncate">
              {log.agents?.name ?? '—'}
            </span>

            {/* Action badge */}
            <span className={`w-16 ml-3 text-xs px-2 py-0.5 rounded-full font-medium text-center ${ACTION_COLORS[log.action] ?? ''}`}>
              {log.action}
            </span>

            {/* Reasoning */}
            <span className="ml-3 text-gray-400 text-xs truncate">
              {log.reasoning ?? (log.token_address ? `Token: ${log.token_address.slice(0, 12)}…` : '—')}
              {log.virality_score != null && (
                <span className="ml-2 text-gray-600">score: {log.virality_score}</span>
              )}
            </span>

            {/* Amount */}
            <span className="w-16 ml-3 text-right font-mono text-xs text-gray-400">
              {log.amount_bnb != null ? `${log.amount_bnb.toFixed(3)} BNB` : '—'}
            </span>

            {/* Outcome */}
            <span className={`w-12 ml-3 text-right font-bold ${
              log.outcome === 'success' ? 'text-green-400'
              : log.outcome === 'failed' ? 'text-red-400'
              : 'text-gray-500'
            }`}>
              {OUTCOME_ICONS[log.outcome] ?? '?'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
