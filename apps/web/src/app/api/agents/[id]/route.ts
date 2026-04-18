// ============================================================
// SIXTEEN — apps/web/src/app/api/agents/[id]/route.ts
// PATCH /api/agents/:id — update agent status (start/stop)
// DELETE /api/agents/:id — remove agent
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json() as { status: 'running' | 'paused' | 'idle' }
    const validStatuses = ['running', 'paused', 'idle']

    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const db = createServerClient()
    const { data, error } = await db
      .from('agents')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ agent: data })
  } catch (err) {
    console.error('[api/agents PATCH] Error:', err)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = createServerClient()
    const { error } = await db
      .from('agents')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/agents DELETE] Error:', err)
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
  }
}
