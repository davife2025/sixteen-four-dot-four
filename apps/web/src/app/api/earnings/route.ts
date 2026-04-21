// ============================================================
// SIXTEEN — /api/earnings
// GET /api/earnings?wallet=0x...
// Returns all meme tokens created by this wallet with
// estimated earnings based on trade volume.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet || !wallet.startsWith('0x')) {
    return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 })
  }

  const db = createServerClient()

  // Get all tokens this wallet created
  const { data: tokens, error } = await db
    .from('meme_tokens')
    .select(`
      id, token_address, name, symbol, image_url, phase,
      bonding_curve_pct, recipient_rate, tax_fee_rate, created_at
    `)
    .eq('creator_wallet', wallet.toLowerCase())
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 })
  }

  if (!tokens?.length) {
    return NextResponse.json({ tokens: [] })
  }

  // For each token, get trade count and estimate earnings
  const enriched = await Promise.all(
    tokens.map(async token => {
      const { data: trades } = await db
        .from('agent_trades')
        .select('id, amount_wei, action')
        .eq('token_address', token.token_address)

      const buyTrades  = (trades ?? []).filter(t => t.action === 'buy')
      const totalTrades = trades?.length ?? 0

      // Estimate volume from buy trades
      const volumeWei = buyTrades.reduce((sum, t) => {
        try { return sum + Number(BigInt(t.amount_wei ?? '0')) } catch { return sum }
      }, 0)
      const volumeBnb = volumeWei / 1e18

      // Royalty formula: volume × fee_rate% × recipient_rate%
      const feeRate       = (token.tax_fee_rate ?? 5) / 100
      const recipientRate = (token.recipient_rate ?? 40) / 100
      const earnedBnb     = volumeBnb * feeRate * recipientRate

      return {
        token_address:        token.token_address,
        name:                 token.name,
        symbol:               token.symbol,
        image_url:            token.image_url,
        phase:                token.phase,
        bonding_curve_pct:    token.bonding_curve_pct ?? 0,
        recipient_rate:       token.recipient_rate ?? 40,
        tax_fee_rate:         token.tax_fee_rate ?? 5,
        created_at:           token.created_at,
        total_trades:         totalTrades,
        estimated_volume_bnb: parseFloat(volumeBnb.toFixed(4)),
        earned_bnb:           parseFloat(earnedBnb.toFixed(6)),
      }
    })
  )

  return NextResponse.json({ tokens: enriched })
}
