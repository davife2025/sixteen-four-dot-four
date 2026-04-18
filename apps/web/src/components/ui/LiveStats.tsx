'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/ui/LiveStats.tsx
// Platform stats bar shown on homepage
// ============================================================

interface LiveStatsProps {
  totalTokens:  number
  activeAgents: number
  totalTrades:  number
}

export function LiveStats({ totalTokens, activeAgents, totalTrades }: LiveStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="card p-4 text-center">
        <div className="stat-label">Tokens launched</div>
        <div className="stat-value text-brand-teal">{totalTokens.toLocaleString()}</div>
      </div>
      <div className="card p-4 text-center">
        <div className="stat-label">Active agents</div>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <div className="stat-value text-green-400">{activeAgents}</div>
        </div>
      </div>
      <div className="card p-4 text-center">
        <div className="stat-label">Trades executed</div>
        <div className="stat-value text-brand-amber">{totalTrades.toLocaleString()}</div>
      </div>
    </div>
  )
}
