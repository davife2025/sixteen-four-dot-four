// ============================================================
// SIXTEEN — apps/web/src/app/api/copy/route.ts
// Copy-Agent API
// POST /api/copy  — follow an agent (start mirroring trades)
// DELETE /api/copy — unfollow an agent
// GET /api/copy   — list all follows for a wallet
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const wallet = searchParams.get('wallet')
  if (!wallet) return NextResponse.json({ error: 'Missing wallet param' }, { status: 400 })

  try {
    const db = createServerClient()
    const { data, error } = await db
      .from('copy_follows')
      .select(`
        id, stake_bnb, active, created_at,
        agents ( id, name, type, status,
          leaderboard ( total_pnl_bnb, rank )
        )
      `)
      .eq('follower_wallet', wallet)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ follows: data ?? [] })
  } catch (err) {
    console.error('[api/copy GET]', err)
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      follower_wallet: string
      agent_id: string
      stake_bnb: number
    }

    if (!body.follower_wallet || !body.agent_id || !body.stake_bnb) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (body.stake_bnb < 0.001) {
      return NextResponse.json({ error: 'Minimum stake is 0.001 BNB' }, { status: 400 })
    }
    if (body.stake_bnb > 1) {
      return NextResponse.json({ error: 'Maximum stake is 1 BNB per agent' }, { status: 400 })
    }

    const db = createServerClient()

    // Ensure user exists
    await db.from('users').upsert(
      { wallet: body.follower_wallet },
      { onConflict: 'wallet' }
    )

    const { data, error } = await db
      .from('copy_follows')
      .upsert(
        {
          follower_wallet: body.follower_wallet,
          agent_id:        body.agent_id,
          stake_bnb:       body.stake_bnb,
          active:          true,
        },
        { onConflict: 'follower_wallet,agent_id' }
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ follow: data }, { status: 201 })
  } catch (err) {
    console.error('[api/copy POST]', err)
    return NextResponse.json({ error: 'Failed to create follow' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as {
      follower_wallet: string
      agent_id: string
    }

    const db = createServerClient()
    const { error } = await db
      .from('copy_follows')
      .update({ active: false })
      .eq('follower_wallet', body.follower_wallet)
      .eq('agent_id', body.agent_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/copy DELETE]', err)
    return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 })
  }
}
