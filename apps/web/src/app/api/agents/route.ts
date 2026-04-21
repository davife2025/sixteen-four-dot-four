import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET() {
  try {
    const db = createServerClient()
    const { data, error } = await db.from('agents')
      .select('id,name,type,status,wallet_address,eip8004_token_id,created_at,leaderboard(total_pnl_bnb,tokens_created,trades_executed,rank)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ agents: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name: string; type: string; owner_wallet: string; wallet_address: string }
    if (!body.name?.trim() || !body.type || !body.owner_wallet || !body.wallet_address) {
      return NextResponse.json({ error: 'Missing required fields: name, type, owner_wallet, wallet_address' }, { status: 400 })
    }
    const db = createServerClient()
    const { data, error } = await db.from('agents').insert({
      name:           body.name.trim(),
      type:           body.type,
      owner_wallet:   body.owner_wallet.toLowerCase(),
      wallet_address: body.wallet_address.toLowerCase(),
      status:         'idle',
    }).select().single()
    if (error) throw error
    return NextResponse.json({ agent: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to create agent' }, { status: 500 })
  }
}
