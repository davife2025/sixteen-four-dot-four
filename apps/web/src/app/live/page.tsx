'use client'
// ============================================================
// SIXTEEN — apps/web/src/app/live/page.tsx
// Live four.meme token browser
// Polls the four.meme API every 15s via /api/fourmeme
// Shows real tokens launching on BNB Chain right now
// ============================================================

import { useEffect, useState, useCallback } from 'react'

interface LiveToken {
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

type SortMode = 'new' | 'trending' | 'graduated' | 'hot'

const SORT_TABS: { key: SortMode; label: string; icon: string }[] = [
  { key: 'new',       label: 'New',       icon: '⚡' },
  { key: 'trending',  label: 'Trending',  icon: '🔥' },
  { key: 'hot',       label: 'Most Held', icon: '👥' },
  { key: 'graduated', label: 'Graduated', icon: '🎓' },
]

const LABEL_COLORS: Record<string, string> = {
  AI:     '#a5a0f0',
  Meme:   '#1de9a0',
  Games:  '#f5b84a',
  Social: '#f0855a',
  Others: '#5a5780',
}

export default function LivePage() {
  const [tokens,   setTokens]   = useState<LiveToken[]>([])
  const [sort,     setSort]     = useState<SortMode>('new')
  const [loading,  setLoading]  = useState(true)
  const [isLive,   setIsLive]   = useState(false)
  const [lastPoll, setLastPoll] = useState<Date | null>(null)
  const [newIds,   setNewIds]   = useState<Set<string>>(new Set())

  const fetchTokens = useCallback(async (s: SortMode, isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    try {
      const res  = await fetch(`/api/fourmeme?sort=${s}&limit=24`)
      const data = await res.json() as { tokens: LiveToken[]; live: boolean }
      
      if (isRefresh) {
        // Highlight new tokens that weren't in the previous list
        setTokens(prev => {
          const prevIds = new Set(prev.map(t => t.tokenAddress))
          const incoming = data.tokens ?? []
          const freshIds = new Set(incoming.filter(t => !prevIds.has(t.tokenAddress)).map(t => t.tokenAddress))
          setNewIds(freshIds)
          setTimeout(() => setNewIds(new Set()), 3000)
          return incoming
        })
      } else {
        setTokens(data.tokens ?? [])
      }
      
      setIsLive(data.live ?? false)
      setLastPoll(new Date())
    } catch {
      // silently fail on refresh
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    void fetchTokens(sort)
  }, [sort, fetchTokens])

  // Poll every 15 seconds
  useEffect(() => {
    const id = setInterval(() => void fetchTokens(sort, true), 15_000)
    return () => clearInterval(id)
  }, [sort, fetchTokens])

  function formatVolume(v: string) {
    const n = parseFloat(v)
    if (n >= 1000) return `${(n/1000).toFixed(1)}K`
    return n.toFixed(2)
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    return `${Math.floor(m/60)}h ago`
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'white', marginBottom: 4 }}>
            Live on four.meme
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Real meme tokens launching on BNB Chain right now
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Live indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 12px', borderRadius: 10,
            background: isLive ? 'rgba(74,222,128,0.08)' : 'rgba(239,159,39,0.08)',
            border: `1px solid ${isLive ? 'rgba(74,222,128,0.2)' : 'rgba(239,159,39,0.2)'}`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isLive ? '#4ade80' : '#f5b84a',
              boxShadow: isLive ? '0 0 6px #4ade80' : 'none',
              animation: 'livePulse 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: isLive ? '#4ade80' : '#f5b84a' }}>
              {isLive ? 'Live' : 'Demo'}
            </span>
            {lastPoll && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                · {lastPoll.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => void fetchTokens(sort, true)}
            style={{
              padding: '6px 12px', borderRadius: 10, fontSize: 12, cursor: 'pointer',
              background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--muted)',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* four.meme link bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
        padding: '10px 16px', borderRadius: 12,
        background: 'rgba(127,119,221,0.06)',
        border: '1px solid rgba(127,119,221,0.15)',
      }}>
        <span style={{ fontSize: 20 }}>🐸</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Powered by </span>
          <a href="https://four.meme" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--purple)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
            four.meme
          </a>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}> — BNB Chain's leading meme launchpad</span>
        </div>
        <a href="https://four.meme" target="_blank" rel="noopener noreferrer" style={{
          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: 'var(--purple)', color: 'white', textDecoration: 'none',
        }}>
          Launch Token →
        </a>
      </div>

      {/* Sort tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {SORT_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSort(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background:   sort === tab.key ? 'rgba(127,119,221,0.15)' : 'var(--surface2)',
              border:       sort === tab.key ? '1px solid rgba(127,119,221,0.3)' : '1px solid var(--border2)',
              color:        sort === tab.key ? 'var(--purple)' : 'var(--muted)',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Token grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div className="skeleton" style={{ height: 140, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 4, marginBottom: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="skeleton" style={{ height: 12, width: '30%' }} />
                <div className="skeleton" style={{ height: 12, width: '25%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }}>
          {tokens.map(token => {
            const isNew      = newIds.has(token.tokenAddress)
            const pctChange  = token.priceChange24h ?? 0
            const isGraduated = token.status === 'COMPLETED'

            return (
              <a
                key={token.tokenAddress}
                href={`https://four.meme/token/${token.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: isNew ? 'rgba(29,233,160,0.06)' : 'var(--surface)',
                  border: `1px solid ${isNew ? 'rgba(29,233,160,0.25)' : 'var(--border)'}`,
                  borderRadius: 14, overflow: 'hidden',
                  transition: 'border-color 0.2s, background 0.2s',
                  cursor: 'pointer',
                }}>
                  {/* Image */}
                  <div style={{ height: 140, background: 'var(--surface2)', position: 'relative', overflow: 'hidden' }}>
                    {token.imageUrl ? (
                      <img src={token.imageUrl} alt={token.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 48, opacity: 0.4 }}>
                        🐸
                      </div>
                    )}

                    {/* NEW flash */}
                    {isNew && (
                      <div style={{
                        position: 'absolute', top: 8, left: 8,
                        background: 'var(--teal)', color: '#000',
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                        letterSpacing: '0.08em',
                      }}>NEW</div>
                    )}

                    {/* Graduated badge */}
                    {isGraduated && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'rgba(245,184,74,0.9)', color: '#000',
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      }}>🎓 GRADUATED</div>
                    )}

                    {/* Label */}
                    <div style={{
                      position: 'absolute', bottom: 8, left: 8,
                      background: 'rgba(0,0,0,0.7)', borderRadius: 5,
                      padding: '2px 7px', fontSize: 10, fontWeight: 600,
                      color: LABEL_COLORS[token.label] ?? 'var(--muted)',
                    }}>{token.label}</div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '12px 14px' }}>
                    {/* Name row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'white', fontSize: 14, lineHeight: 1.3 }}>
                          {token.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {token.symbol}
                        </div>
                      </div>
                      {/* Price change */}
                      <div style={{
                        fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                        color: pctChange >= 0 ? '#4ade80' : '#f0855a',
                      }}>
                        {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                      </div>
                    </div>

                    {/* Description */}
                    {token.description && (
                      <p style={{
                        fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {token.description}
                      </p>
                    )}

                    {/* Bonding curve */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Bonding Curve
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--teal)' }}>
                          {token.bondingPct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 100,
                          width: `${token.bondingPct}%`,
                          background: isGraduated
                            ? '#f5b84a'
                            : 'linear-gradient(90deg, var(--purple), var(--teal))',
                          transition: 'width 0.5s',
                        }} />
                      </div>
                    </div>

                    {/* Footer stats */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'white', fontFamily: 'JetBrains Mono, monospace' }}>
                            {formatVolume(token.volume)}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Vol BNB</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>
                            {token.holders.toLocaleString()}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Holders</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {timeAgo(token.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
        Data from{' '}
        <a href="https://four.meme" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--purple)', textDecoration: 'none' }}>four.meme
        </a>
        {' '}· Refreshes every 15 seconds ·{' '}
        {isLive ? 'Live data' : 'Demo data — four.meme API unreachable in current env'}
      </div>
    </div>
  )
}
