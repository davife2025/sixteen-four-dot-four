'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/feed/TokenFeed.tsx
// Live meme token feed with Supabase Realtime subscription
// New tokens appear at the top when agents launch them
// ============================================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TokenCard } from './TokenCard'

interface Token {
  id: string
  token_address: string
  name: string
  symbol: string
  description: string
  image_url: string
  video_url: string | null
  asset_type: 'image' | 'video'
  label: string
  phase: string
  bonding_curve_pct: number
  virality_score: number
  sixteen_score: number
  created_at: string
  agents?: { name: string; type: string } | null
}

interface TokenFeedProps {
  initialTokens: Token[]
}

export function TokenFeed({ initialTokens }: TokenFeedProps) {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    // Subscribe to realtime inserts on meme_tokens
    const channel = supabase
      .channel('meme_tokens_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meme_tokens' },
        (payload) => {
          const newToken = payload.new as Token
          setTokens((prev) => [newToken, ...prev])
          setNewCount((c) => c + 1)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meme_tokens' },
        (payload) => {
          const updated = payload.new as Token
          setTokens((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="space-y-4">
      {/* New tokens banner */}
      {newCount > 0 && (
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' })
            setNewCount(0)
          }}
          className="w-full text-center text-sm text-brand-teal bg-teal-900/20 border border-teal-800/40 rounded-xl py-2 hover:bg-teal-900/30 transition-colors"
        >
          ↑ {newCount} new token{newCount > 1 ? 's' : ''} launched by agents
        </button>
      )}

      {/* Token grid */}
      {tokens.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p className="text-lg">No tokens yet.</p>
          <p className="text-sm mt-1">Start an agent to launch the first meme token.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tokens.map((token) => (
            <TokenCard key={token.id} token={token} />
          ))}
        </div>
      )}
    </div>
  )
}
