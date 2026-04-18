// ============================================================
// SIXTEEN — apps/agent/src/trends.ts
// Social trend intelligence — feeds Kimi K2 with what to
// create memes about. Pulls from X/Twitter API + Google Trends
// ============================================================

import axios from 'axios'

export interface TrendSignal {
  topic: string
  volume: number        // relative search/mention volume
  source: 'twitter' | 'google' | 'crypto'
  context: string       // short description of why it's trending
  cryptoRelevant: boolean
}

// ── X / Twitter trending topics ──────────────────────────

async function getTwitterTrends(): Promise<TrendSignal[]> {
  const bearerToken = process.env['TWITTER_BEARER_TOKEN']
  if (!bearerToken) {
    console.warn('[trends] No TWITTER_BEARER_TOKEN — skipping Twitter trends')
    return []
  }

  // Twitter API v2 — trending topics (Worldwide WOE ID = 1)
  const res = await axios.get(
    'https://api.twitter.com/2/trends/by/woeid/1',
    { headers: { Authorization: `Bearer ${bearerToken}` } }
  )

  const raw = (res.data as { data: Array<{ name: string; tweet_count: number }> }).data ?? []
  return raw.slice(0, 10).map((t) => ({
    topic: t.name,
    volume: t.tweet_count,
    source: 'twitter' as const,
    context: `Trending on X/Twitter with ${t.tweet_count.toLocaleString()} tweets`,
    cryptoRelevant: /crypto|bnb|bitcoin|defi|meme|web3|nft|ai/i.test(t.name),
  }))
}

// ── CoinGecko trending crypto ─────────────────────────────

async function getCryptoTrends(): Promise<TrendSignal[]> {
  const res = await axios.get('https://api.coingecko.com/api/v3/search/trending')
  const coins = (res.data as {
    coins: Array<{ item: { name: string; symbol: string; market_cap_rank: number } }>
  }).coins ?? []

  return coins.slice(0, 5).map((c) => ({
    topic: `${c.item.name} (${c.item.symbol})`,
    volume: 100 - (c.item.market_cap_rank ?? 100),
    source: 'crypto' as const,
    context: `Trending on CoinGecko — rank #${c.item.market_cap_rank}`,
    cryptoRelevant: true,
  }))
}

// ── Aggregate and rank all trends ────────────────────────

export async function getTopTrends(limit = 5): Promise<TrendSignal[]> {
  const [twitter, crypto] = await Promise.allSettled([
    getTwitterTrends(),
    getCryptoTrends(),
  ])

  const all: TrendSignal[] = [
    ...(twitter.status === 'fulfilled' ? twitter.value : []),
    ...(crypto.status === 'fulfilled' ? crypto.value : []),
  ]

  // Sort: crypto-relevant first, then by volume
  return all
    .sort((a, b) => {
      if (a.cryptoRelevant && !b.cryptoRelevant) return -1
      if (!a.cryptoRelevant && b.cryptoRelevant) return 1
      return b.volume - a.volume
    })
    .slice(0, limit)
}

// ── Format trends for Kimi K2 context ────────────────────

export function formatTrendsForKimi(trends: TrendSignal[]): string {
  if (trends.length === 0) return 'No trend data available — use general crypto/meme culture'
  return trends
    .map((t, i) => `${i + 1}. "${t.topic}" — ${t.context}`)
    .join('\n')
}
