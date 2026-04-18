// ============================================================
// SIXTEEN — apps/web/src/app/api/rounds/route.ts
// GET  /api/rounds        — list competition rounds
// POST /api/rounds        — create a new round
// POST /api/rounds/start  — start the pending round
// POST /api/rounds/end    — end the active round
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET() {
  try {
    const db = createServerClient()
    const { data, error } = await db
      .from('competition_rounds')
      .select(`
        *,
        agents ( name, type )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    return NextResponse.json({ rounds: data ?? [] })
  } catch (err) {
    console.error('[api/rounds GET] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch rounds' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: 'create' | 'start' | 'end'
      round_id?: string
      winner_agent_id?: string
      duration_hours?: number
    }

    const db = createServerClient()

    if (body.action === 'create') {
      const { data, error } = await db
        .from('competition_rounds')
        .insert({ duration_hours: body.duration_hours ?? 24 })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ round: data }, { status: 201 })
    }

    if (body.action === 'start' && body.round_id) {
      const { data, error } = await db
        .from('competition_rounds')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', body.round_id)
        .eq('status', 'pending')
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ round: data })
    }

    if (body.action === 'end' && body.round_id) {
      const { data, error } = await db
        .from('competition_rounds')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          winner_agent_id: body.winner_agent_id ?? null,
        })
        .eq('id', body.round_id)
        .eq('status', 'active')
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ round: data })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[api/rounds POST] Error:', err)
    return NextResponse.json({ error: 'Failed to process round action' }, { status: 500 })
  }
}
