// ============================================================
// SIXTEEN — apps/web/src/app/api/analytics/price/route.ts
// GET /api/analytics/price?token=0x…&range=24H
// Returns OHLC candles for a meme token from Bitquery
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

type TimeRange = '1H' | '6H' | '24H' | '7D'

const RANGE_CONFIG: Record<TimeRange, { intervalMins: number; hoursBack: number }> = {
  '1H':  { intervalMins: 1,  hoursBack: 1   },
  '6H':  { intervalMins: 5,  hoursBack: 6   },
  '24H': { intervalMins: 15, hoursBack: 24  },
  '7D':  { intervalMins: 60, hoursBack: 168 },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tokenAddress = searchParams.get('token')
  const range        = (searchParams.get('range') ?? '24H') as TimeRange

  if (!tokenAddress) {
    return NextResponse.json({ error: 'Missing token param' }, { status: 400 })
  }

  const config    = RANGE_CONFIG[range] ?? RANGE_CONFIG['24H']
  const apiKey    = process.env['BITQUERY_API_KEY']

  if (!apiKey) {
    // Return empty candles if no API key configured
    return NextResponse.json({ candles: [] })
  }

  const since = new Date(Date.now() - config.hoursBack * 3600_000).toISOString()

  const query = `
    query GetOHLC($token: String!, $since: ISO8601DateTime!, $intervalMins: Int!) {
      EVM(network: bsc_testnet) {
        DEXTradeByTokens(
          where: {
            Trade: { Currency: { SmartContract: { is: $token } } }
            Block: { Time: { since: $since } }
          }
          orderBy: { ascendingByField: "Block_Time" }
          limit: { count: 500 }
        ) {
          Block { Time(interval: { in: minutes, count: $intervalMins }) }
          Trade {
            open:   Price(minimum: Block_Number)
            high:   Price(maximum: Trade_Price)
            low:    Price(minimum: Trade_Price)
            close:  Price(maximum: Block_Number)
            volume: sum(of: Trade_AmountInUSD)
          }
        }
      }
    }
  `

  try {
    const res = await fetch('https://streaming.bitquery.io/graphql', {
      method:  'POST',
      headers: {
        'X-API-KEY':    apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          token:       tokenAddress,
          since,
          intervalMins: config.intervalMins,
        },
      }),
    })

    const data = await res.json() as {
      data?: {
        EVM?: {
          DEXTradeByTokens?: Array<{
            Block: { Time: string }
            Trade: { open: number; high: number; low: number; close: number; volume: number }
          }>
        }
      }
    }

    const raw = data?.data?.EVM?.DEXTradeByTokens ?? []
    const candles = raw.map((item) => ({
      time:   item.Block.Time,
      open:   item.Trade.open   ?? 0,
      high:   item.Trade.high   ?? 0,
      low:    item.Trade.low    ?? 0,
      close:  item.Trade.close  ?? 0,
      volume: item.Trade.volume ?? 0,
    }))

    return NextResponse.json({ candles }, {
      headers: { 'Cache-Control': 'public, max-age=15' },
    })
  } catch (err) {
    console.error('[api/analytics/price]', err)
    return NextResponse.json({ candles: [] })
  }
}
