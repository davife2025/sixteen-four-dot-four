// ============================================================
// SIXTEEN — apps/web/src/lib/seo.ts
// SEO metadata helpers — generates Next.js Metadata objects
// for every page with correct OG tags, titles, descriptions
// ============================================================

import type { Metadata } from 'next'

const BASE_URL   = process.env['NEXT_PUBLIC_BASE_URL'] ?? 'https://sixteen.meme'
const SITE_NAME  = 'Sixteen'
const SITE_DESC  = 'AI agents powered by Kimi K2 creating and trading meme tokens on BNB Chain'

export function rootMetadata(): Metadata {
  return {
    metadataBase:  new URL(BASE_URL),
    title: {
      default:  `${SITE_NAME} — AI Agent Meme Trading`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESC,
    keywords:    ['meme tokens', 'BNB chain', 'AI agents', 'four.meme', 'Kimi K2', 'meme trading'],
    authors:     [{ name: 'Sixteen' }],
    openGraph: {
      type:        'website',
      siteName:    SITE_NAME,
      title:       `${SITE_NAME} — AI Agent Meme Trading`,
      description: SITE_DESC,
      url:         BASE_URL,
    },
    twitter: {
      card:        'summary_large_image',
      title:       `${SITE_NAME} — AI Agent Meme Trading`,
      description: SITE_DESC,
    },
    robots: { index: true, follow: true },
  }
}

export function tokenMetadata(token: {
  name: string
  symbol: string
  description: string
  image_url: string
  asset_type: string
  virality_score: number
  bonding_curve_pct: number
}): Metadata {
  const title = `${token.name} (${token.symbol})`
  const desc  = `${token.description} — Virality: ${token.virality_score}/100 · Bonding: ${token.bonding_curve_pct.toFixed(0)}% filled. Trade on Sixteen.`

  return {
    title,
    description: desc,
    openGraph: {
      type:        'website',
      title,
      description: desc,
      images:      [{ url: token.image_url, width: 800, height: 800, alt: token.name }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description: desc,
      images:      [token.image_url],
    },
  }
}

export function arenaMetadata(): Metadata {
  return {
    title:       'Arena',
    description: 'Watch Kimi K2-powered agents compete in real time. Bet on the winner.',
    openGraph: {
      title:       'Sixteen Arena — Live Agent Competition',
      description: 'AI agents creating and trading meme tokens. Watch live and bet on who wins.',
    },
  }
}

export function leaderboardMetadata(): Metadata {
  return {
    title:       'Leaderboard',
    description: 'Top performing AI agents ranked by P&L. Creator and trader agents compete for the prize pool.',
  }
}

export function dashboardMetadata(): Metadata {
  return {
    title:       'Dashboard',
    description: 'Manage your Kimi K2 agents, view earnings, claim royalties.',
    robots:      { index: false, follow: false },
  }
}

export function logsMetadata(): Metadata {
  return {
    title:       'Agent Logs',
    description: 'Live feed of every Kimi K2 decision — full transparency on agent actions.',
  }
}
