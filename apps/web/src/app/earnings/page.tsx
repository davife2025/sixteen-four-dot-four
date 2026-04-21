'use client'
// ============================================================
// SIXTEEN — /earnings
// Shows a creator exactly how much they've earned from their
// tokens on four.meme — royalties from every trade.
// This is the most important page. It's why people use Sixteen.
// ============================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface EarningToken {
  token_address:    string
  name:             string
  symbol:           string
  image_url:        string
  phase:            string
  bonding_curve_pct: number
  recipient_rate:   number
  tax_fee_rate:     number
  created_at:       string
  total_trades:     number
  estimated_volume_bnb: number
  earned_bnb:       number
}

const PHASE_COLOR: Record<string, string> = {
  insider:   'var(--yellow)',
  public:    'var(--green)',
  graduated: 'var(--t0)',
  pending:   'var(--t3)',
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

export default function EarningsPage() {
  const [wallet,   setWallet]   = useState('')
  const [input,    setInput]    = useState('')
  const [tokens,   setTokens]   = useState<EarningToken[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function lookup(addr: string) {
    if (!addr.trim() || !addr.startsWith('0x')) {
      setError('Enter a valid wallet address starting with 0x')
      return
    }
    setLoading(true); setError(''); setTokens([])
    try {
      const res  = await fetch(`/api/earnings?wallet=${addr.trim()}`)
      const data = await res.json() as { tokens?: EarningToken[]; error?: string }
      if (!res.ok || data.error) { setError(data.error ?? 'Failed to fetch earnings'); return }
      setTokens(data.tokens ?? [])
      setWallet(addr.trim())
    } catch { setError('Network error — try again') }
    finally { setLoading(false) }
  }

  const totalEarned = tokens.reduce((s, t) => s + (t.earned_bnb ?? 0), 0)
  const totalTrades = tokens.reduce((s, t) => s + (t.total_trades ?? 0), 0)

  return (
    <div className="page" style={{ maxWidth: 700, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 24, color: 'var(--t0)', marginBottom: 8, letterSpacing: '-0.3px' }}>
          Your Earnings
        </h1>
        <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
          Every meme token you launch on four.meme earns you royalties on every trade.
          Enter your wallet to see everything you've earned.
        </p>
      </div>

      {/* Wallet input */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <input
          className="input"
          placeholder="Your wallet address (0x…)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup(input)}
          style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, flex: 1 }}
        />
        <button
          onClick={() => lookup(input)}
          disabled={loading}
          className="btn-primary"
          style={{ flexShrink: 0, minWidth: 100 }}
        >
          {loading ? 'Looking…' : 'Check'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, color: 'var(--red)', background: 'rgba(255,85,85,0.07)', border: '1px solid rgba(255,85,85,0.2)', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Summary stats */}
      {tokens.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Earned',   value: `${totalEarned.toFixed(4)} BNB`,   color: 'var(--green)'  },
              { label: 'Tokens Launched', value: tokens.length,                     color: 'var(--t0)'    },
              { label: 'Total Trades',   value: totalTrades.toLocaleString(),        color: 'var(--yellow)' },
            ].map(s => (
              <div key={s.label} className="kpi">
                <div className="kpi-val" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
                <div className="kpi-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tip about four.meme royalties */}
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(185,241,74,0.05)', border: '1px solid rgba(185,241,74,0.15)', marginBottom: 24, fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
            Royalties accumulate on-chain as your token trades. Claim them at{' '}
            <a href="https://four.meme" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>four.meme</a>{' '}
            → your token page → Claim Creator Royalties.
          </div>

          {/* Token list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tokens.map(token => (
              <div key={token.token_address} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

                  {/* Image */}
                  <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--s2)' }}>
                    {token.image_url
                      ? <img src={token.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🐸</div>}
                  </div>

                  {/* Name + phase */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {token.name}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, flexShrink: 0, color: PHASE_COLOR[token.phase] ?? 'var(--t3)', background: `${PHASE_COLOR[token.phase] ?? 'var(--s3)'}18`, border: `1px solid ${PHASE_COLOR[token.phase] ?? 'var(--s3)'}30` }}>
                        {token.phase}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'Space Mono, monospace' }}>
                      ${token.symbol} · {timeAgo(token.created_at)}
                    </div>
                    {/* Bonding bar */}
                    <div style={{ marginTop: 8 }}>
                      <div className="prog-bar">
                        <div className="prog-fill" style={{ width: `${token.bonding_curve_pct ?? 0}%` }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>
                        {(token.bonding_curve_pct ?? 0).toFixed(1)}% bonding curve
                      </div>
                    </div>
                  </div>

                  {/* Earnings */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 18, color: 'var(--green)', marginBottom: 3 }}>
                      +{token.earned_bnb.toFixed(4)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 6 }}>BNB earned</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                      {token.total_trades} trades · {token.recipient_rate}% royalty
                    </div>
                  </div>

                  {/* Links */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <a href={`https://four.meme/token/${token.token_address}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, background: 'var(--s2)', border: '1px solid var(--s3)', color: 'var(--t1)', whiteSpace: 'nowrap' }}>
                      four.meme ↗
                    </a>
                    <Link href={`/token/${token.token_address}`}
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, background: 'var(--s2)', border: '1px solid var(--s3)', color: 'var(--t1)', whiteSpace: 'nowrap', display: 'block', textAlign: 'center' }}>
                      Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state after search */}
      {wallet && tokens.length === 0 && !loading && !error && (
        <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 600, color: 'var(--t0)', fontSize: 15, marginBottom: 6 }}>No tokens found</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 20 }}>
            No meme tokens launched from this wallet on Sixteen yet.
          </div>
          <Link href="/" className="btn-primary" style={{ fontSize: 13 }}>
            Launch your first meme token
          </Link>
        </div>
      )}

      {/* Default state — no search yet */}
      {!wallet && !loading && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>Or create your first meme token to start earning:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { icon: '📤', title: 'Upload a meme',    sub: 'Any image or video you own',        href: '/' },
              { icon: '🎨', title: 'Generate with AI', sub: 'Describe it, FLUX generates it',     href: '/' },
              { icon: '🤖', title: 'Deploy an agent',  sub: 'AI creates tokens for you 24/7',     href: '/onboarding' },
            ].map(c => (
              <Link key={c.title} href={c.href} style={{ display: 'block', padding: '18px 16px', borderRadius: 10, background: 'var(--s1)', border: '1px solid var(--s3)', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(185,241,74,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--s3)')}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 13, marginBottom: 4 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5 }}>{c.sub}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
