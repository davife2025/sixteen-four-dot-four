'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/token/TokenRisk.tsx
// Kimi K2 risk analysis for a token.
// Shows: risk level, summary, flags, opportunity.
// Loads on demand — user clicks to trigger.
// ============================================================

import { useState } from 'react'
import { useKimi } from '@/hooks/useKimi'

interface Props {
  token: {
    name: string
    symbol: string
    description: string
    phase: string
    bonding_curve_pct: number
    virality_score: number
    sixteen_score: number
    creator_wallet?: string
    tax_fee_rate?: number
    recipient_rate?: number
  }
}

interface RiskResult {
  risk:        'low' | 'medium' | 'high'
  summary:     string
  flags:       string[]
  opportunity: string
}

const RISK_COLOR: Record<string, string> = {
  low:    'var(--green)',
  medium: 'var(--yellow)',
  high:   '#ff6060',
}

const RISK_BG: Record<string, string> = {
  low:    'rgba(185,241,74,0.07)',
  medium: 'rgba(245,200,66,0.07)',
  high:   'rgba(255,96,96,0.07)',
}

export function TokenRisk({ token }: Props) {
  const [result,    setResult]    = useState<RiskResult | null>(null)
  const [triggered, setTriggered] = useState(false)
  const kimi = useKimi()

  async function analyse() {
    setTriggered(true)
    const content = await kimi.call({
      mode: 'risk',
      data: {
        name:              token.name,
        symbol:            token.symbol,
        description:       token.description,
        phase:             token.phase,
        bonding_curve_pct: token.bonding_curve_pct,
        virality_score:    token.virality_score,
        sixteen_score:     token.sixteen_score,
        fee_rate:          token.tax_fee_rate,
        recipient_rate:    token.recipient_rate,
      },
    })
    const parsed = kimi.parseJSON<RiskResult>(content)
    if (parsed) setResult(parsed)
  }

  if (!triggered) {
    return (
      <button
        onClick={analyse}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          background: 'var(--s2)', border: '1px solid var(--s3)',
          color: 'var(--t2)', fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--green)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--s3)')}
      >
        <span>Analyse risk with Kimi K2</span>
        <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'Space Mono, monospace' }}>AI</span>
      </button>
    )
  }

  if (kimi.loading) {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--s2)',
        border: '1px solid var(--s3)', fontSize: 12, color: 'var(--t3)' }}>
        Kimi K2 is analysing this token…
      </div>
    )
  }

  if (!result) {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,96,96,0.07)',
        border: '1px solid rgba(255,96,96,0.2)', fontSize: 12, color: '#ff6060' }}>
        {kimi.error ?? 'Analysis unavailable'}
      </div>
    )
  }

  return (
    <div style={{ borderRadius: 10, background: RISK_BG[result.risk],
      border: `1px solid ${RISK_COLOR[result.risk]}33`, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: `1px solid ${RISK_COLOR[result.risk]}22` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'Space Mono, monospace',
            color: 'var(--t3)', letterSpacing: '0.1em' }}>KIMI K2 ANALYSIS</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 100,
          background: `${RISK_COLOR[result.risk]}18`,
          color: RISK_COLOR[result.risk],
          border: `1px solid ${RISK_COLOR[result.risk]}44`,
          textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
          {result.risk} risk
        </span>
      </div>

      {/* Summary */}
      <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t1)', lineHeight: 1.6,
        borderBottom: `1px solid ${RISK_COLOR[result.risk]}22` }}>
        {result.summary}
      </div>

      {/* Flags */}
      {result.flags.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${RISK_COLOR[result.risk]}22` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', marginBottom: 6,
            textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Flags</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {result.flags.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', gap: 6 }}>
                <span style={{ color: '#ff6060', flexShrink: 0 }}>•</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunity */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', marginBottom: 4,
          textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Opportunity</div>
        <div style={{ fontSize: 12, color: RISK_COLOR[result.risk] }}>{result.opportunity}</div>
      </div>
    </div>
  )
}
