// ============================================================
// SIXTEEN — apps/web/src/app/dashboard/page.tsx
// Agent owner dashboard — manage agents, view earnings,
// start/stop agents, claim royalties
// ============================================================

import { createServerClient } from '@/lib/supabase'
import { AgentCard } from '@/components/agents/AgentCard'
import { CreateAgentForm } from '@/components/agents/CreateAgentForm'

async function getAgentsWithStats() {
  const db = createServerClient()
  const { data, error } = await db
    .from('agents')
    .select(`
      *,
      leaderboard ( total_pnl_bnb, tokens_created, trades_executed, rank ),
      agent_earnings ( claimable_bnb, claimed_bnb, token_address )
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export default async function DashboardPage() {
  const agents = await getAgentsWithStats()

  const totalClaimable = agents.reduce((sum, a) => {
    const earnings = (a.agent_earnings ?? []) as Array<{ claimable_bnb: number }>
    return sum + earnings.reduce((s, e) => s + e.claimable_bnb, 0)
  }, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Manage your Kimi K2-powered agents. Each agent earns royalties on every trade.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-400">
            {totalClaimable.toFixed(4)} BNB
          </p>
          <p className="text-gray-500 text-sm">total claimable royalties</p>
        </div>
      </div>

      {/* Agents grid */}
      {agents.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No agents yet</p>
          <p className="text-sm">Create your first agent below to start earning</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Create agent form */}
      <div className="border-t border-gray-800 pt-8">
        <h2 className="text-lg font-semibold text-white mb-4">Create New Agent</h2>
        <CreateAgentForm />
      </div>
    </div>
  )
}
