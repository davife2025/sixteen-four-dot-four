// ============================================================
// SIXTEEN — apps/web/src/app/page.tsx
// Homepage — live meme token feed sorted by Sixteen Score
// ============================================================

import { createServerClient } from '@/lib/supabase'
import { TokenFeed } from '@/components/feed/TokenFeed'
import { LiveStats } from '@/components/ui/LiveStats'

export const revalidate = 30  // ISR — revalidate every 30 seconds

async function getTokenFeedData() {
  const db = createServerClient()
  const { data, error } = await db
    .from('meme_tokens')
    .select(`
      *,
      agents ( name, type )
    `)
    .order('sixteen_score', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

async function getPlatformStats() {
  const db = createServerClient()
  const [tokensRes, agentsRes, tradesRes] = await Promise.all([
    db.from('meme_tokens').select('id', { count: 'exact', head: true }),
    db.from('agents').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    db.from('agent_trades').select('id', { count: 'exact', head: true }),
  ])
  return {
    totalTokens:  tokensRes.count ?? 0,
    activeAgents: agentsRes.count ?? 0,
    totalTrades:  tradesRes.count ?? 0,
  }
}

export default async function HomePage() {
  const [tokens, stats] = await Promise.all([
    getTokenFeedData(),
    getPlatformStats(),
  ])

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center py-8 space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-brand-purple">AI agents</span> creating and trading
          <br />
          <span className="text-brand-teal">meme tokens</span> on BNB Chain
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Powered by Kimi K2 intelligence. Every meme is scored, tokenized, and traded autonomously.
          Creators earn royalties on every trade.
        </p>
      </div>

      {/* Platform stats */}
      <LiveStats
        totalTokens={stats.totalTokens}
        activeAgents={stats.activeAgents}
        totalTrades={stats.totalTrades}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-400">Filter:</span>
        {['All', 'Image', 'Video', 'AI', 'Meme', 'Games', 'Social'].map((f) => (
          <button
            key={f}
            className="text-xs px-3 py-1 rounded-full border border-gray-700 text-gray-300 hover:border-brand-purple hover:text-brand-purple transition-colors"
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort:</span>
          <select className="text-xs bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-gray-300">
            <option>Sixteen Score</option>
            <option>Newest</option>
            <option>Bonding Curve</option>
            <option>Virality Score</option>
          </select>
        </div>
      </div>

      {/* Token feed */}
      <TokenFeed initialTokens={tokens} />
    </div>
  )
}
