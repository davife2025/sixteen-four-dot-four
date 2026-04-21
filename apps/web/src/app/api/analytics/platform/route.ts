// ============================================================
// SIXTEEN — apps/web/src/app/api/analytics/platform/route.ts
// GET /api/analytics/platform
// Returns platform-wide stats: total volume, top tokens,
// agent performance, active users, round stats
// ============================================================

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'
export const revalidate = 60   // cache for 60 seconds

export async function GET() {
  try {
    const db = createServerClient()

    const [
      tokenCountRes,
      tradeCountRes,
      agentCountRes,
      topTokensRes,
      topAgentsRes,
      recentRoundsRes,
      videoCountRes,
    ] = await Promise.all([
      // Total tokens launched
      db.from('meme_tokens').select('id', { count: 'exact', head: true }),

      // Total trades executed
      db.from('agent_trades').select('id', { count: 'exact', head: true }),

      // Active agents right now
      db.from('agents').select('id', { count: 'exact', head: true }).eq('status', 'running'),

      // Top 5 tokens by sixteen_score
      db.from('meme_tokens')
        .select('name, symbol, token_address, sixteen_score, virality_score, bonding_curve_pct, asset_type, image_url')
        .order('sixteen_score', { ascending: false })
        .limit(5),

      // Top 3 agents by P&L
      db.from('leaderboard')
        .select(`
          total_pnl_bnb, tokens_created, trades_executed,
          agents ( name, type )
        `)
        .order('total_pnl_bnb', { ascending: false })
        .limit(3),

      // Last 3 competition rounds
      db.from('competition_rounds')
        .select(`
          id, status, started_at, ended_at, duration_hours, prize_pool_bnb,
          agents ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(3),

      // Video token count
      db.from('meme_tokens').select('id', { count: 'exact', head: true }).eq('asset_type', 'video'),
    ])

    // Total BNB volume (sum of all buy amounts)
    const { data: volumeData } = await db
      .from('agent_trades')
      .select('amount_wei')
      .eq('action', 'buy')
      .limit(10000)

    const totalVolumeBnb = (volumeData ?? []).reduce((sum, t) => {
      return sum + parseFloat(
        (BigInt(t.amount_wei) / BigInt(1e14)).toString()
      ) / 10000
    }, 0)

    return NextResponse.json({
      stats: {
        totalTokens:    tokenCountRes.count  ?? 0,
        totalTrades:    tradeCountRes.count  ?? 0,
        activeAgents:   agentCountRes.count  ?? 0,
        videoTokens:    videoCountRes.count  ?? 0,
        totalVolumeBnb: parseFloat(totalVolumeBnb.toFixed(4)),
      },
      topTokens:  topTokensRes.data  ?? [],
      topAgents:  topAgentsRes.data  ?? [],
      recentRounds: recentRoundsRes.data ?? [],
    })
  } catch (err) {
    console.error('[api/analytics/platform]', err)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
