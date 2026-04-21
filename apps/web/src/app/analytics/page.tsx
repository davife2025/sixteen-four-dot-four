import { createServerClient } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60
export const metadata = { title: 'Analytics | Sixteen' }

async function getData() {
  const db = createServerClient()
  const [tokensRes, tradesRes, agentsRes, lbRes, roundsRes, videosRes] = await Promise.allSettled([
    db.from('meme_tokens').select('id', { count: 'exact', head: true }),
    db.from('agent_trades').select('id, amount_wei, action, created_at'),
    db.from('agents').select('id, name, type, status').order('created_at', { ascending: false }),
    db.from('leaderboard')
      .select('total_pnl_bnb, tokens_created, trades_executed, agents(name,type)')
      .order('total_pnl_bnb', { ascending: false })
      .limit(10),
    db.from('competition_rounds')
      .select('id, status, started_at, ended_at, duration_hours')
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('meme_tokens').select('id', { count: 'exact', head: true }).eq('asset_type', 'video'),
  ])

  const allTrades = tradesRes.status === 'fulfilled' ? (tradesRes.value.data ?? []) : []
  const buys      = allTrades.filter(t => t.action === 'buy')
  const since24h  = new Date(Date.now() - 86_400_000).toISOString()

  function tobnb(wei: string) {
    try { return parseFloat((BigInt(wei) / BigInt(1e14)).toString()) / 10000 }
    catch { return 0 }
  }

  const totalVol = buys.reduce((s, t) => s + tobnb(t.amount_wei), 0)
  const vol24h   = buys.filter(t => t.created_at > since24h).reduce((s, t) => s + tobnb(t.amount_wei), 0)
  const allAgents = agentsRes.status === 'fulfilled' ? (agentsRes.value.data ?? []) : []

  return {
    totalTokens:  tokensRes.status  === 'fulfilled' ? (tokensRes.value.count  ?? 0) : 0,
    videoTokens:  videosRes.status  === 'fulfilled' ? (videosRes.value.count  ?? 0) : 0,
    totalTrades:  allTrades.length,
    totalAgents:  allAgents.length,
    runningAgents: allAgents.filter((a: any) => a.status === 'running').length,
    totalVol:     parseFloat(totalVol.toFixed(4)),
    vol24h:       parseFloat(vol24h.toFixed(4)),
    leaderboard:  lbRes.status    === 'fulfilled' ? (lbRes.value.data    ?? []) : [],
    rounds:       roundsRes.status === 'fulfilled' ? (roundsRes.value.data ?? []) : [],
  }
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: 'var(--t3)',
      textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12,
    }}>
      {text}
    </div>
  )
}

const RND_COLOR: Record<string, string> = {
  active:  'var(--green)',
  pending: 'var(--yellow)',
  ended:   'var(--t3)',
}

export default async function AnalyticsPage() {
  const d = await getData()

  return (
    <div className="page-wrap">

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--t0)', marginBottom: 4 }}>
          Analytics
        </h1>
        <p style={{ fontSize: 13, color: 'var(--t2)' }}>
          Everything happening on Sixteen — tokens, agents, trades, rounds
        </p>
      </div>

      {/* ── Top KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        {[
          { label: 'Tokens Launched', value: d.totalTokens,   accent: 'var(--green)'  },
          { label: 'Total Trades',    value: d.totalTrades,   accent: 'var(--t0)'     },
          { label: 'Total Volume',    value: `${d.totalVol}`, accent: 'var(--green)',  unit: 'BNB' },
          { label: '24h Volume',      value: `${d.vol24h}`,   accent: 'var(--yellow)', unit: 'BNB' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 12,
            padding: '18px 20px',
          }}>
            <div style={{
              fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 26,
              color: k.accent, lineHeight: 1, marginBottom: 6,
            }}>
              {k.value}
              {k.unit && <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 5, fontFamily: 'Space Grotesk, sans-serif' }}>{k.unit}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Agent KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        {[
          { label: 'Total Agents',  value: d.totalAgents   },
          { label: 'Running Now',   value: d.runningAgents, accent: d.runningAgents > 0 ? 'var(--green)' : undefined },
          { label: 'Video Memes',   value: d.videoTokens   },
          { label: 'Image Memes',   value: d.totalTokens - d.videoTokens },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 12,
            padding: '18px 20px',
          }}>
            <div style={{
              fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 26,
              color: k.accent ?? 'var(--t0)', lineHeight: 1, marginBottom: 6,
            }}>
              {k.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>

        {/* Agent leaderboard */}
        <div>
          <SectionLabel text="Top Agents — All Time" />
          <div style={{ background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 12, overflow: 'hidden' }}>
            {d.leaderboard.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
                No agent data yet —{' '}
                <Link href="/dashboard" style={{ color: 'var(--green)' }}>deploy an agent</Link>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--s3)' }}>
                    {['#', 'Agent', 'Type', 'P&L (BNB)', 'Tokens', 'Trades'].map((h, i) => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: i >= 3 ? 'right' : 'left',
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--t3)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(d.leaderboard as any[]).map((row, i) => {
                    const pnl = row.total_pnl_bnb ?? 0
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, color: i < 3 ? 'var(--green)' : 'var(--t3)' }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--t0)' }}>
                          {row.agents?.name ?? '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>
                          {row.agents?.type ?? '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'Space Mono, monospace', fontSize: 12, fontWeight: 700, color: pnl >= 0 ? 'var(--green)' : '#ff6060' }}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--t2)' }}>
                          {row.tokens_created ?? 0}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--t2)' }}>
                          {row.trades_executed ?? 0}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Competition rounds */}
        <div>
          <SectionLabel text="Competition Rounds" />
          <div style={{ background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 12, overflow: 'hidden' }}>
            {d.rounds.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
                No rounds yet —{' '}
                <Link href="/admin" style={{ color: 'var(--green)' }}>start one</Link>
              </div>
            ) : (
              <div>
                {(d.rounds as any[]).map((r, i) => {
                  const color = RND_COLOR[r.status] ?? 'var(--t3)'
                  const start = r.started_at ? new Date(r.started_at) : null
                  const end   = r.ended_at   ? new Date(r.ended_at)   : null
                  const dur   = start && end
                    ? Math.round((end.getTime() - start.getTime()) / 60000)
                    : null
                  return (
                    <div key={r.id} style={{
                      padding: '14px 18px',
                      borderBottom: i < d.rounds.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    }}>
                      {/* Status + duration */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                          color, background: `${color}15`, border: `1px solid ${color}33`,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {r.status}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: 'var(--t2)' }}>
                          {r.duration_hours}h round
                        </span>
                      </div>
                      {/* Date + elapsed */}
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                        {start ? start.toLocaleDateString('en', { day:'numeric', month:'short', year:'numeric' }) : 'Not started'}
                        {dur != null && <span style={{ marginLeft: 8 }}>{dur < 60 ? `${dur}m` : `${Math.floor(dur/60)}h ${dur%60}m`}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Link href="/arena" style={{
              display: 'block', padding: '10px 14px', borderRadius: 8, textDecoration: 'none',
              background: 'var(--s1)', border: '1px solid var(--s3)',
              fontSize: 12, fontWeight: 600, color: 'var(--t1)', textAlign: 'center',
              transition: 'border-color 0.15s',
            }}>
              View Arena
            </Link>
            <Link href="/admin" style={{
              display: 'block', padding: '10px 14px', borderRadius: 8, textDecoration: 'none',
              background: 'var(--s1)', border: '1px solid var(--s3)',
              fontSize: 12, fontWeight: 600, color: 'var(--t1)', textAlign: 'center',
              transition: 'border-color 0.15s',
            }}>
              Admin Panel
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}