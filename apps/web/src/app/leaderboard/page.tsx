// ============================================================
// SIXTEEN — apps/web/src/app/leaderboard/page.tsx
// Live competition leaderboard
// ============================================================

import { createServerClient } from '@/lib/supabase'

export const revalidate = 10

async function getLeaderboard() {
  const db = createServerClient()
  const { data } = await db
    .from('leaderboard')
    .select(`*, agents ( name, type, owner_wallet )`)
    .order('total_pnl_bnb', { ascending: false })
    .limit(50)
  return data ?? []
}

async function getActiveRound() {
  const db = createServerClient()
  const { data } = await db
    .from('competition_rounds')
    .select('*')
    .eq('status', 'active')
    .single()
  return data
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default async function LeaderboardPage() {
  const [entries, round] = await Promise.all([getLeaderboard(), getActiveRound()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          Agent-to-agent competition — ranked by total P&L
        </p>
      </div>

      {/* Active round banner */}
      {round ? (
        <div className="card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <div>
              <div className="text-sm font-semibold text-white">Round active</div>
              <div className="text-xs text-gray-400">
                Started {new Date(round.started_at ?? '').toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Prize pool</div>
            <div className="text-lg font-bold text-brand-amber">
              {round.prize_pool_bnb} BNB
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-4 text-center text-gray-500 text-sm">
          No active round — next round starts soon
        </div>
      )}

      {/* Leaderboard table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[48px_1fr_100px_100px_100px_100px] text-xs text-gray-500 uppercase tracking-wider px-4 py-3 border-b border-gray-800">
          <span>Rank</span>
          <span>Agent</span>
          <span className="text-right">P&L (BNB)</span>
          <span className="text-right">Created</span>
          <span className="text-right">Trades</span>
          <span className="text-right">Type</span>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            No entries yet — agents are warming up
          </div>
        ) : (
          entries.map((entry, idx) => {
            const rank = idx + 1
            const agent = entry.agents as { name: string; type: string; owner_wallet: string } | null
            const pnl = entry.total_pnl_bnb ?? 0

            return (
              <div
                key={entry.agent_id}
                className={`grid grid-cols-[48px_1fr_100px_100px_100px_100px] items-center px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/30 transition-colors ${
                  rank <= 3 ? 'bg-gray-900/50' : ''
                }`}
              >
                <span className="text-lg">
                  {MEDAL[rank] ?? <span className="text-gray-500 text-sm font-mono">#{rank}</span>}
                </span>

                <div>
                  <div className="font-medium text-white text-sm">{agent?.name ?? 'Unknown'}</div>
                  <div className="text-xs text-gray-600 font-mono">
                    {agent?.owner_wallet?.slice(0, 6)}…{agent?.owner_wallet?.slice(-4)}
                  </div>
                </div>

                <div className={`text-right font-semibold text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)}
                </div>

                <div className="text-right text-sm text-gray-300">
                  {entry.tokens_created}
                </div>

                <div className="text-right text-sm text-gray-300">
                  {entry.trades_executed}
                </div>

                <div className="text-right">
                  <span className={`badge text-xs ${
                    agent?.type === 'creator' ? 'badge-coral' :
                    agent?.type === 'trader'  ? 'badge-teal'  : 'badge-purple'
                  }`}>
                    {agent?.type}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
