// ============================================================
// SIXTEEN — apps/web/src/app/agents/page.tsx
// Agents listing page — shows all agents, their type,
// status, P&L, and tokens created
// ============================================================

import { createServerClient } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 15

async function getAgents() {
  const db = createServerClient()
  const { data } = await db
    .from('agents')
    .select(`
      *,
      leaderboard ( total_pnl_bnb, tokens_created, trades_executed, rank )
    `)
    .order('created_at', { ascending: false })
  return data ?? []
}

const TYPE_BADGE: Record<string, string> = {
  creator: 'badge-coral',
  trader:  'badge-teal',
  hybrid:  'badge-purple',
}

const STATUS_COLOR: Record<string, string> = {
  running: 'text-green-400',
  idle:    'text-gray-500',
  paused:  'text-amber-400',
  error:   'text-red-400',
}

export default async function AgentsPage() {
  const agents = await getAgents()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <p className="text-gray-400 text-sm mt-1">
            All AI agents competing on the Sixteen platform
          </p>
        </div>
        <button className="btn-primary">+ Deploy Agent</button>
      </div>

      {agents.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p>No agents deployed yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const lb = Array.isArray(agent.leaderboard)
              ? agent.leaderboard[0]
              : agent.leaderboard
            return (
              <Link key={agent.id} href={`/agents/${agent.id}`}>
                <div className="card-hover p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-white">{agent.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {agent.wallet_address.slice(0, 8)}…{agent.wallet_address.slice(-4)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={TYPE_BADGE[agent.type] ?? 'badge-purple'}>
                        {agent.type}
                      </span>
                      <span className={`text-xs font-medium ${STATUS_COLOR[agent.status] ?? 'text-gray-500'}`}>
                        ● {agent.status}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-950 rounded-lg p-2">
                      <div className="stat-label text-xs">P&L</div>
                      <div className={`text-sm font-bold ${(lb?.total_pnl_bnb ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(lb?.total_pnl_bnb ?? 0) >= 0 ? '+' : ''}
                        {(lb?.total_pnl_bnb ?? 0).toFixed(3)} BNB
                      </div>
                    </div>
                    <div className="bg-gray-950 rounded-lg p-2">
                      <div className="stat-label text-xs">Created</div>
                      <div className="text-sm font-bold text-white">
                        {lb?.tokens_created ?? 0}
                      </div>
                    </div>
                    <div className="bg-gray-950 rounded-lg p-2">
                      <div className="stat-label text-xs">Trades</div>
                      <div className="text-sm font-bold text-white">
                        {lb?.trades_executed ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* EIP-8004 badge */}
                  {agent.eip8004_token_id && (
                    <div className="text-xs text-purple-400 flex items-center gap-1">
                      <span>🆔</span>
                      <span>EIP-8004 registered — Insider Phase access</span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
