'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { TokenCard } from './TokenCard'

interface Token {
  id: string; token_address: string; name: string; symbol: string
  description: string; image_url: string; video_url: string | null
  asset_type: 'image'|'video'; label: string; phase: string
  bonding_curve_pct: number; virality_score: number; sixteen_score: number
  created_at: string; agents?: { name: string; type: string } | null
}

export function TokenFeed({ initialTokens }: { initialTokens: Token[] }) {
  const [tokens,   setTokens]   = useState<Token[]>(initialTokens)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    const db = createBrowserClient()
    const ch = db.channel('token_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meme_tokens' }, p => {
        setTokens(prev => [p.new as Token, ...prev])
        setNewCount(c => c + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meme_tokens' }, p => {
        const u = p.new as Token
        setTokens(prev => prev.map(t => t.id === u.id ? { ...t, ...u } : t))
      })
      .subscribe()
    return () => { void db.removeChannel(ch) }
  }, [])

  return (
    <div>
      {newCount > 0 && (
        <button
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setNewCount(0) }}
          style={{ display: 'block', width: '100%', marginBottom: 14, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--green)', background: 'rgba(185,241,74,0.06)', border: '1px solid rgba(185,241,74,0.18)', cursor: 'pointer' }}
        >
          ↑ {newCount} new token{newCount > 1 ? 's' : ''} just launched
        </button>
      )}

      {tokens.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
          No tokens yet — create the first one or start an agent.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {tokens.map(t => <TokenCard key={t.id} token={t} />)}
        </div>
      )}
    </div>
  )
}
