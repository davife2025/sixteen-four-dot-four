// ============================================================
// SIXTEEN — apps/web/src/app/api/fourmeme/route.ts
// Proxy to four.meme public API — fetches live tokens
// GET /api/fourmeme?sort=new|trending|graduated&limit=20
//
// four.meme public endpoints (no auth needed):
//   POST /meme-api/v1/public/token/query  — list tokens
//   GET  /meme-api/v1/public/token/info/:address — single token
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

const FOURMEME_BASE = 'https://four.meme/meme-api'

type SortMode = 'new' | 'trending' | 'graduated' | 'hot'

const SORT_MAP: Record<SortMode, { orderBy: string; orderDir: string; status?: string }> = {
  new:       { orderBy: 'createTime',    orderDir: 'desc' },
  trending:  { orderBy: 'tradeVolume',   orderDir: 'desc' },
  graduated: { orderBy: 'createTime',    orderDir: 'desc', status: 'COMPLETED' },
  hot:       { orderBy: 'totalHolders',  orderDir: 'desc' },
}

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sort  = (searchParams.get('sort') ?? 'new') as SortMode
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  const sortConfig = SORT_MAP[sort] ?? SORT_MAP.new

  try {
    const body: Record<string, unknown> = {
      pageSize: limit,
      pageNum:  1,
      orderBy:  sortConfig.orderBy,
      orderDir: sortConfig.orderDir,
      networkCode: 'BSC',
    }
    if (sortConfig.status) body['status'] = sortConfig.status

    const res = await fetch(`${FOURMEME_BASE}/v1/public/token/query`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'Sixteen-Platform/1.0',
        'Origin':       'https://four.meme',
        'Referer':      'https://four.meme/',
      },
      body: JSON.stringify(body),
      next: { revalidate: 15 },  // cache 15 seconds
    })

    if (!res.ok) {
      // Return mock data so the UI still works during development
      return NextResponse.json({ tokens: getMockTokens(), live: false })
    }

    const data = await res.json() as {
      code: number
      data?: {
        list?: FourMemeToken[]
        total?: number
      }
    }

    if (data.code !== 0 || !data.data?.list) {
      return NextResponse.json({ tokens: getMockTokens(), live: false })
    }

    const tokens = data.data.list.map(normalizeToken)
    return NextResponse.json({ tokens, total: data.data.total ?? tokens.length, live: true }, {
      headers: { 'Cache-Control': 'public, max-age=15' }
    })

  } catch (err) {
    console.error('[api/fourmeme]', err)
    // Fallback to mock data — never show an error to the user
    return NextResponse.json({ tokens: getMockTokens(), live: false })
  }
}

// ── Types ─────────────────────────────────────────────────

interface FourMemeToken {
  tokenAddress: string
  name: string
  symbol: string
  description?: string
  image?: string
  logo?: string
  createTime?: number
  status?: string
  totalFunding?: string
  maxFunding?: string
  tradeVolume?: string
  totalHolders?: number
  lastPrice?: string
  priceChange24h?: number
  creatorAddress?: string
  label?: string
}

interface NormalizedToken {
  tokenAddress: string
  name: string
  symbol: string
  description: string
  imageUrl: string
  createdAt: string
  status: string
  bondingPct: number
  volume: string
  holders: number
  price: string
  priceChange24h: number
  label: string
  isFourMemeLive: true
}

function normalizeToken(t: FourMemeToken): NormalizedToken {
  const totalFunding = parseFloat(t.totalFunding ?? '0')
  const maxFunding   = parseFloat(t.maxFunding   ?? '24')
  const bondingPct   = maxFunding > 0 ? Math.min((totalFunding / maxFunding) * 100, 100) : 0

  return {
    tokenAddress: t.tokenAddress ?? '',
    name:         t.name         ?? 'Unknown',
    symbol:       t.symbol       ?? '???',
    description:  t.description  ?? '',
    imageUrl:     t.image ?? t.logo ?? '',
    createdAt:    t.createTime ? new Date(t.createTime * 1000).toISOString() : new Date().toISOString(),
    status:       t.status       ?? 'TRADING',
    bondingPct:   parseFloat(bondingPct.toFixed(1)),
    volume:       t.tradeVolume  ?? '0',
    holders:      t.totalHolders ?? 0,
    price:        t.lastPrice    ?? '0',
    priceChange24h: t.priceChange24h ?? 0,
    label:        t.label        ?? 'Meme',
    isFourMemeLive: true,
  }
}

// ── Mock data for dev/offline ──────────────────────────────

function getMockTokens(): NormalizedToken[] {
  return [
    { tokenAddress: '0xabc001', name: 'Pepe on BNB',       symbol: 'PEPEBNB', description: 'The original frog, now on BNB.',       imageUrl: '', createdAt: new Date().toISOString(), status: 'TRADING',   bondingPct: 67.3, volume: '12.4', holders: 342,  price: '0.0000234', priceChange24h: 12.5,  label: 'Meme',   isFourMemeLive: true },
    { tokenAddress: '0xabc002', name: 'Kimi K2 Agent',     symbol: 'KIMI',    description: 'First AI agent meme on BNB Chain.',    imageUrl: '', createdAt: new Date().toISOString(), status: 'TRADING',   bondingPct: 22.1, volume: '4.1',  holders: 89,   price: '0.0000089', priceChange24h: 44.2,  label: 'AI',     isFourMemeLive: true },
    { tokenAddress: '0xabc003', name: 'Moon Doge',         symbol: 'MDOGE',   description: 'Doge going to the moon. Again.',       imageUrl: '', createdAt: new Date().toISOString(), status: 'TRADING',   bondingPct: 91.0, volume: '28.7', holders: 1204, price: '0.0000891', priceChange24h: 3.1,   label: 'Meme',   isFourMemeLive: true },
    { tokenAddress: '0xabc004', name: 'BNB Frog',          symbol: 'BNBFROG', description: 'BNB Chain\'s mascot frog.',             imageUrl: '', createdAt: new Date().toISOString(), status: 'COMPLETED', bondingPct: 100,  volume: '44.2', holders: 2341, price: '0.0002341', priceChange24h: -8.4,  label: 'Meme',   isFourMemeLive: true },
    { tokenAddress: '0xabc005', name: 'CZ\'s Broccoli',    symbol: 'BROCCO',  description: 'Inspired by CZ\'s famous broccoli.',   imageUrl: '', createdAt: new Date().toISOString(), status: 'TRADING',   bondingPct: 44.8, volume: '7.9',  holders: 512,  price: '0.0000412', priceChange24h: 21.0,  label: 'Social', isFourMemeLive: true },
    { tokenAddress: '0xabc006', name: 'Four Seasons',      symbol: 'FOUR',    description: '4 × 4 = 16. The Sixteen meme.',        imageUrl: '', createdAt: new Date().toISOString(), status: 'TRADING',   bondingPct: 8.3,  volume: '1.2',  holders: 34,   price: '0.0000044', priceChange24h: 180.0, label: 'AI',     isFourMemeLive: true },
  ]
}
