// ============================================================
// SIXTEEN — apps/agent/src/trends.ts
// Trend intelligence for Kimi K2 creator agent
//
// Sources (in priority order):
//   1. CoinGecko trending (free, no key needed)
//   2. Twitter/X API v2 (needs TWITTER_BEARER_TOKEN)
//   3. Kimi K2 fallback — invents plausible trends when APIs fail
// ============================================================

import axios from 'axios'
import { kimiChat } from '@sixteen/ai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat'

export interface TrendSignal {
  topic:          string
  volume:         number
  source:         'coingecko' | 'twitter' | 'kimi' | 'static'
  context:        string
  cryptoRelevant: boolean
}

// ── CoinGecko trending crypto (free, no key) ──────────────

async function getCryptoTrends(): Promise<TrendSignal[]> {
  try {
    const res = await axios.get<{
      coins: Array<{ item: { name: string; symbol: string; market_cap_rank: number; data?: { price_change_percentage_24h?: { usd?: number } } } }>
    }>('https://api.coingecko.com/api/v3/search/trending', { timeout: 8000 })

    return (res.data.coins ?? []).slice(0, 8).map(c => ({
      topic:          `${c.item.name} (${c.item.symbol.toUpperCase()})`,
      volume:         Math.max(0, 100 - (c.item.market_cap_rank ?? 100)),
      source:         'coingecko' as const,
      context:        `Trending on CoinGecko — rank #${c.item.market_cap_rank ?? '?'}${c.item.data?.price_change_percentage_24h?.usd ? `, ${c.item.data.price_change_percentage_24h.usd.toFixed(1)}% 24h` : ''}`,
      cryptoRelevant: true,
    }))
  } catch (err) {
    console.warn('[trends] CoinGecko failed:', (err as Error).message)
    return []
  }
}

// ── Twitter/X API v2 trending (optional) ─────────────────

async function getTwitterTrends(): Promise<TrendSignal[]> {
  const token = process.env['TWITTER_BEARER_TOKEN']
  if (!token) return []

  try {
    const res = await axios.get<{ data: Array<{ name: string; tweet_count: number }> }>(
      'https://api.twitter.com/2/trends/by/woeid/1',
      { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
    )
    return (res.data.data ?? []).slice(0, 10).map(t => ({
      topic:          t.name,
      volume:         t.tweet_count,
      source:         'twitter' as const,
      context:        `Trending on X with ${t.tweet_count.toLocaleString()} tweets`,
      cryptoRelevant: /crypto|bnb|bitcoin|defi|meme|web3|nft|ai|blockchain/i.test(t.name),
    }))
  } catch (err) {
    console.warn('[trends] Twitter API failed:', (err as Error).message)
    return []
  }
}

// ── Kimi K2 fallback — generates plausible trends ─────────

async function getKimiTrends(): Promise<TrendSignal[]> {
  console.log('[trends] Using Kimi K2 to generate trend context…')
  try {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a crypto and internet culture analyst. Generate 5 plausible trending topics 
that would make great meme tokens right now. Consider: current crypto market mood, AI news, 
meme culture, BNB Chain ecosystem, popular internet culture.
Respond ONLY with a JSON array, no markdown:
[{"topic":"<topic name>","context":"<why it's trending>","cryptoRelevant":true|false}]`
      },
      {
        role: 'user',
        content: `Today is ${new Date().toDateString()}. What are the 5 most meme-able trending topics right now? JSON only.`
      }
    ]

    const response = await kimiChat({ messages, temperature: 0.9, maxTokens: 512 })
    const raw      = response.content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '')
    const parsed   = JSON.parse(raw) as Array<{ topic: string; context: string; cryptoRelevant: boolean }>

    return parsed.slice(0, 5).map((t, i) => ({
      topic:          t.topic,
      volume:         80 - i * 10,
      source:         'kimi' as const,
      context:        t.context,
      cryptoRelevant: t.cryptoRelevant,
    }))
  } catch (err) {
    console.warn('[trends] Kimi fallback failed:', (err as Error).message)
    return getStaticFallback()
  }
}

// ── Static fallback — last resort ────────────────────────

function getStaticFallback(): TrendSignal[] {
  return [
    { topic: 'BNB All Time High',  volume: 90, source: 'static', context: 'BNB making new highs',          cryptoRelevant: true  },
    { topic: 'AI Agents on Chain', volume: 85, source: 'static', context: 'Agentic AI trend exploding',    cryptoRelevant: true  },
    { topic: 'Meme Season',        volume: 80, source: 'static', context: 'Q4 meme season is here',        cryptoRelevant: true  },
    { topic: 'PancakeSwap V4',     volume: 75, source: 'static', context: 'PancakeSwap upgrade launching', cryptoRelevant: true  },
    { topic: 'four.meme Launch',   volume: 70, source: 'static', context: 'New tokens launching on four.meme every minute', cryptoRelevant: true },
  ]
}

// ── Aggregate all trend sources ───────────────────────────

export async function getTopTrends(limit = 5): Promise<TrendSignal[]> {
  // Fetch all sources in parallel
  const [cryptoResult, twitterResult] = await Promise.allSettled([
    getCryptoTrends(),
    getTwitterTrends(),
  ])

  const crypto  = cryptoResult.status  === 'fulfilled' ? cryptoResult.value  : []
  const twitter = twitterResult.status === 'fulfilled' ? twitterResult.value : []
  const all     = [...crypto, ...twitter]

  // If we have real data, use it
  if (all.length > 0) {
    return all
      .sort((a, b) => {
        if (a.cryptoRelevant && !b.cryptoRelevant) return -1
        if (!a.cryptoRelevant && b.cryptoRelevant) return 1
        return b.volume - a.volume
      })
      .slice(0, limit)
  }

  // No real data — use Kimi K2 to generate plausible trends
  console.log('[trends] All external APIs failed — falling back to Kimi K2')
  const kimiTrends = await getKimiTrends()
  return kimiTrends.slice(0, limit)
}

// ── Format for Kimi K2 context ────────────────────────────

export function formatTrendsForKimi(trends: TrendSignal[]): string {
  if (trends.length === 0) return 'No trend data available — create something timeless and funny'
  return trends
    .map((t, i) => `${i + 1}. "${t.topic}" [${t.source}] — ${t.context}`)
    .join('\n')
}
