// ============================================================
// SIXTEEN — apps/web/src/app/api/tokens/route.ts
// REST API: GET /api/tokens
// Returns paginated token feed with optional filters
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const assetType  = searchParams.get('asset_type')   // 'image' | 'video'
  const label      = searchParams.get('label')          // 'AI' | 'Meme' | ...
  const phase      = searchParams.get('phase')          // 'insider' | 'public' | 'graduated'
  const sortBy     = searchParams.get('sort') ?? 'sixteen_score'
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const offset     = parseInt(searchParams.get('offset') ?? '0')

  const validSorts = ['sixteen_score', 'created_at', 'bonding_curve_pct', 'virality_score']
  const sort = validSorts.includes(sortBy) ? sortBy : 'sixteen_score'

  try {
    const db = createServerClient()
    let query = db
      .from('meme_tokens')
      .select(`
        id, token_address, name, symbol, description,
        image_url, video_url, asset_type, label,
        phase, bonding_curve_pct, virality_score, sixteen_score,
        tax_fee_rate, recipient_rate, created_at,
        agents ( name, type )
      `, { count: 'exact' })
      .order(sort, { ascending: false })
      .range(offset, offset + limit - 1)

    if (assetType) query = query.eq('asset_type', assetType)
    if (label)     query = query.eq('label', label)
    if (phase)     query = query.eq('phase', phase)

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({
      tokens: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    console.error('[api/tokens] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 })
  }
}
