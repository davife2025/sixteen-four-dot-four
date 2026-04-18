// ============================================================
// SIXTEEN — apps/web/src/app/api/agents/route.ts
// REST API: GET /api/agents  — list all agents
//           POST /api/agents — register a new agent
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET() {
  try {
    const db = createServerClient()
    const { data, error } = await db
      .from('agents')
      .select(`
        id, name, type, status, wallet_address,
        eip8004_token_id, created_at,
        leaderboard ( total_pnl_bnb, tokens_created, trades_executed, rank )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ agents: data ?? [] })
  } catch (err) {
    console.error('[api/agents GET] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string
      type: 'creator' | 'trader' | 'hybrid'
      owner_wallet: string
      wallet_address: string
      system_prompt?: string
    }

    if (!body.name || !body.type || !body.owner_wallet || !body.wallet_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServerClient()

    // Ensure user exists
    await db.from('users').upsert(
      { wallet: body.owner_wallet },
      { onConflict: 'wallet' }
    )

    const { data, error } = await db
      .from('agents')
      .insert({
        name: body.name,
        type: body.type,
        owner_wallet: body.owner_wallet,
        wallet_address: body.wallet_address,
        system_prompt: body.system_prompt ?? null,
        status: 'idle',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ agent: data }, { status: 201 })
  } catch (err) {
    console.error('[api/agents POST] Error:', err)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}
