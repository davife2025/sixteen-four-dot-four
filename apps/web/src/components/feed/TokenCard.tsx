'use client'
import Link from 'next/link'

interface Token {
  id: string; token_address: string; name: string; symbol: string
  description: string; image_url: string; video_url?: string | null
  asset_type: 'image'|'video'; label: string; phase: string
  bonding_curve_pct: number; virality_score: number; sixteen_score: number
  created_at: string; agents?: { name: string; type: string } | null
}

export function TokenCard({ token }: { token: Token }) {
  const score = token.sixteen_score ?? 0
  const curve = token.bonding_curve_pct ?? 0
  const isAI  = !!token.agents

  const phaseColor: Record<string,string> = {
    insider: 'var(--yellow)', public: 'var(--green)',
    graduated: 'var(--t0)', pending: 'var(--t3)',
  }

  return (
    <Link href={`/token/${token.token_address}`} style={{ display: 'block' }}>
      <div
        className="card2"
        style={{ overflow: 'hidden', transition: 'border-color 0.15s, transform 0.15s', cursor: 'pointer' }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'rgba(185,241,74,0.3)'; el.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'var(--s3)'; el.style.transform = 'translateY(0)' }}
      >
        {/* Image */}
        <div style={{ height: 160, background: 'var(--s1)', position: 'relative', overflow: 'hidden' }}>
          {token.image_url ? (
            <img src={token.image_url} alt={token.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, opacity: 0.3 }}>🐸</div>
          )}

          {/* Score */}
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.75)', borderRadius: 5, padding: '2px 7px', fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, color: score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--yellow)' : 'var(--t2)' }}>
            {score.toFixed(0)}
          </div>

          {/* Video badge */}
          {token.asset_type === 'video' && (
            <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.75)', borderRadius: 5, padding: '2px 7px', fontSize: 9, fontWeight: 700, color: 'var(--yellow)', letterSpacing: '0.06em' }}>
              VIDEO
            </div>
          )}

          {/* AI / Human badge */}
          <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.72)', borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: isAI ? 'var(--green)' : 'var(--yellow)' }}>
            {isAI ? 'AI' : 'Human'}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 14, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {token.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'Space Mono, monospace', marginTop: 1 }}>
                {token.symbol}
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, marginLeft: 8, flexShrink: 0, color: phaseColor[token.phase] ?? 'var(--t3)', background: `${phaseColor[token.phase] ?? 'var(--s3)'}18`, border: `1px solid ${phaseColor[token.phase] ?? 'var(--s3)'}30` }}>
              {token.phase}
            </span>
          </div>

          {/* Description */}
          <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {token.description}
          </p>

          {/* Progress bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bonding Curve</span>
              <span style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', color: curve > 80 ? 'var(--yellow)' : 'var(--green)' }}>{curve.toFixed(1)}%</span>
            </div>
            <div className="prog-bar">
              <div className="prog-fill" style={{ width: `${curve}%` }} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>{token.agents?.name ?? 'Community'}</span>
            <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'Space Mono, monospace' }}>{token.virality_score ?? 0} vrl</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
