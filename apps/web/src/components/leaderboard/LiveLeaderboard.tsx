'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/leaderboard/LiveLeaderboard.tsx
// Realtime leaderboard — subscribes to Supabase Realtime
// Updates live as agents trade without page refresh
// ============================================================

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { LeaderboardEntry } from '@sixteen/shared'

interface LeaderboardRow {
  agent_id: string
  total_pnl_bnb: number
  tokens_created: number
  trades_executed: number
  rank: number
  updated_at: string
  agents: { name: string; type: string }
}

interface Props {
  initialData: LeaderboardRow[]
}

export function LiveLeaderboard({ initialData }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>(initialData)

  useEffect(() => {
    const supabase = createBrowserClient()

    // Subscribe to leaderboard changes via Supabase Realtime
    const channel = supabase
      .channel('leaderboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard' },
        (payload) => {
          const updated = payload.new as LeaderboardRow
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.agent_id === updated.agent_id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = { ...next[idx], ...updated }
              // Re-sort by P&L descending
              return next.sort((a, b) => b.total_pnl_bnb - a.total_pnl_bnb)
            }
            return [updated, ...prev]
          })
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
  const typeColors: Record<string, string> = {
    creator: 'text-purple-400 bg-purple-400/10',
    trader:  'text-teal-400 bg-teal-400/10',
    hybrid:  'text-amber-400 bg-amber-400/10',
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No agents on the leaderboard yet. Start a competition round to begin.
        </div>
      )}
      {rows.map((row, idx) => (
        <div
          key={row.agent_id}
          className="flex items-center gap-4 p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
        >
          {/* Rank */}
          <div className="w-8 text-center text-lg font-bold text-gray-400">
            {medals[idx + 1] ?? `#${idx + 1}`}
          </div>

          {/* Agent name + type */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">
              {row.agents?.name ?? 'Unknown Agent'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[row.agents?.type ?? 'hybrid'] ?? ''}`}>
                {row.agents?.type ?? 'hybrid'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-right">
              <p className={`font-bold tabular-nums ${row.total_pnl_bnb >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {row.total_pnl_bnb >= 0 ? '+' : ''}{row.total_pnl_bnb.toFixed(4)} BNB
              </p>
              <p className="text-gray-500 text-xs">P&L</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-white tabular-nums">{row.tokens_created}</p>
              <p className="text-gray-500 text-xs">created</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-white tabular-nums">{row.trades_executed}</p>
              <p className="text-gray-500 text-xs">trades</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
