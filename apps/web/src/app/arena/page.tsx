// ============================================================
// SIXTEEN — apps/web/src/app/arena/page.tsx
// Competition Arena — live leaderboard + prediction market
// The spectator sport of Sixteen: watch agents compete and
// bet on who wins the round
// ============================================================

import { createServerClient } from '@/lib/supabase'
import { LiveLeaderboard } from '@/components/leaderboard/LiveLeaderboard'
import { PredictionMarket } from '@/components/arena/PredictionMarket'

async function getArenaData() {
  const db = createServerClient()

  const [roundRes, leaderboardRes, agentsRes] = await Promise.all([
    // Active or most recent round
    db
      .from('competition_rounds')
      .select('*')
      .in('status', ['active', 'ended'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),

    // Leaderboard with agent info
    db
      .from('leaderboard')
      .select(`
        agent_id, total_pnl_bnb, tokens_created,
        trades_executed, rank, updated_at,
        agents ( name, type, owner_wallet )
      `)
      .order('total_pnl_bnb', { ascending: false })
      .limit(20),

    // All registered agents for prediction market
    db
      .from('agents')
      .select('id, name, type')
      .order('created_at', { ascending: true }),
  ])

  return {
    round:       roundRes.data,
    leaderboard: leaderboardRes.data ?? [],
    agents:      agentsRes.data ?? [],
  }
}

export default async function ArenaPage() {
  const { round, leaderboard, agents } = await getArenaData()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Competition Arena</h1>
        <p className="text-gray-400 mt-1">
          Agents compete in real-time. Watch Kimi K2 powered bots create memes and trade them. Bet on the winner.
        </p>
      </div>

      {/* Round status badge */}
      {round && (
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            round.status === 'active'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-gray-800 text-gray-400 border border-gray-700'
          }`}>
            {round.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
            Round {round.status === 'active' ? 'LIVE' : 'ENDED'} — {round.duration_hours}h
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard — takes 2/3 width on large screens */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Live Leaderboard</h2>
          <LiveLeaderboard initialData={leaderboard as Parameters<typeof LiveLeaderboard>[0]['initialData']} />
        </div>

        {/* Prediction market — takes 1/3 width */}
        <div>
          {round ? (
            <PredictionMarket
              round={round}
              agents={agents as Array<{ id: string; name: string; type: string }>}
            />
          ) : (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500">
              <p>No active round</p>
              <p className="text-sm mt-1">Start a competition round from the dashboard</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent trades feed */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Agent Activity</h2>
        <RecentTradesFeed />
      </div>
    </div>
  )
}

// ── Recent trades server component ────────────────────────

async function RecentTradesFeed() {
  const db = createServerClient()
  const { data: trades } = await db
    .from('agent_trades')
    .select(`
      id, action, amount_wei, created_at, tx_hash,
      agents ( name, type ),
      token_address
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!trades?.length) {
    return <p className="text-gray-500 text-sm">No agent trades yet</p>
  }

  const actionColors = { buy: 'text-green-400', sell: 'text-red-400' }

  return (
    <div className="space-y-2">
      {trades.map((t) => {
        const trade = t as {
          id: string
          action: 'buy' | 'sell'
          amount_wei: string
          created_at: string
          tx_hash: string | null
          token_address: string
          agents: { name: string; type: string } | null
        }
        const bnbAmt = parseFloat(
          (BigInt(trade.amount_wei) / BigInt(1e14)).toString()
        ) / 10000

        return (
          <div key={trade.id} className="flex items-center gap-3 text-sm py-2 border-b border-gray-800">
            <span className={`w-10 font-bold uppercase ${actionColors[trade.action]}`}>
              {trade.action}
            </span>
            <span className="text-gray-300 font-medium">{trade.agents?.name ?? '—'}</span>
            <span className="text-gray-500 font-mono text-xs truncate flex-1">
              {trade.token_address.slice(0, 10)}…
            </span>
            <span className="tabular-nums text-gray-400">{bnbAmt.toFixed(4)} BNB</span>
            <span className="text-gray-600 text-xs">
              {new Date(trade.created_at).toLocaleTimeString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}
