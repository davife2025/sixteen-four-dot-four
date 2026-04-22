// ============================================================
// SIXTEEN — apps/web/src/app/api/predictions/route.ts
// REST API: GET  /api/predictions?round_id=xxx
//           POST /api/predictions — record a bet (after on-chain tx)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const roundId = searchParams.get('round_id')

  try {
    const db  = createServerClient()
    let query = db
      .from('predictions')
      .select(`
        id, bettor_wallet, stake_bnb, settled, payout_bnb, created_at,
        agents ( id, name, type ),
        competition_rounds ( id, status )
      `)
      .order('created_at', { ascending: false })

    if (roundId) query = query.eq('round_id', roundId)

    const { data, error } = await query.limit(100)
    if (error) throw error

    // Aggregate stakes per agent for this round
    const stakeByAgent: Record<string, number> = {}
    for (const p of data ?? []) {
      const pred = p as { agents: { id: string }[] | null; stake_bnb: number }
 const aid = Array.isArray(pred.agents) && pred.agents[0]
  ? pred.agents[0].id ?? 'unknown'
  : 'unknown'
      stakeByAgent[aid] = (stakeByAgent[aid] ?? 0) + pred.stake_bnb
    }

    return NextResponse.json({
      predictions: data ?? [],
      stakeByAgent,
    })
  } catch (err) {
    console.error('[api/predictions GET] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      round_id:      string
      bettor_wallet: string
      agent_id:      string
      stake_bnb:     number
      tx_hash:       string
    }

    if (!body.round_id || !body.bettor_wallet || !body.agent_id || !body.stake_bnb || !body.tx_hash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()

    // Verify round is still active
    const { data: round, error: roundErr } = await db
      .from('competition_rounds')
      .select('status')
      .eq('id', body.round_id)
      .single()

    if (roundErr || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }
    if (round.status !== 'active') {
      return NextResponse.json({ error: 'Round is not active — betting closed' }, { status: 400 })
    }

    const { data, error } = await db
      .from('predictions')
      .insert({
        round_id:      body.round_id,
        bettor_wallet: body.bettor_wallet,
        agent_id:      body.agent_id,
        stake_bnb:     body.stake_bnb,
        tx_hash:       body.tx_hash,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ prediction: data }, { status: 201 })
  } catch (err) {
    console.error('[api/predictions POST] Error:', err)
    return NextResponse.json({ error: 'Failed to record prediction' }, { status: 500 })
  }
}