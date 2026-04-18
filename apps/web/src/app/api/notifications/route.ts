// ============================================================
// SIXTEEN — apps/web/src/app/api/notifications/route.ts
// GET  /api/notifications?wallet=0x…  — fetch unread
// POST /api/notifications/read        — mark all read
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const wallet = searchParams.get('wallet')
  if (!wallet) return NextResponse.json({ notifications: [] })

  try {
    const db = createServerClient()
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('owner_wallet', wallet)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return NextResponse.json({ notifications: data ?? [] })
  } catch (err) {
    console.error('[api/notifications GET]', err)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { wallet } = await req.json() as { wallet: string }
    if (!wallet) return NextResponse.json({ error: 'Missing wallet' }, { status: 400 })

    const db = createServerClient()
    await db
      .from('notifications')
      .update({ read: true })
      .eq('owner_wallet', wallet)
      .eq('read', false)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/notifications POST]', err)
    return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 })
  }
}
