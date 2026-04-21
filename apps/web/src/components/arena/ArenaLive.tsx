'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/arena/ArenaLive.tsx
//
// The Arena is where you watch Sixteen work.
// No prediction market. No betting.
//
// Shows:
//   - Round timer + status
//   - Live agent P&L race (who is winning right now)
//   - Real-time skill feed — every four.meme API call surfaced
//   - Recent trades table
//
// The four.meme skills shown in the skill feed:
//   create-instant  → agent launched a token
//   buy             → agent bought on bonding curve
//   sell            → agent exited a position
//   quote-buy       → agent simulated a buy
//   token-info      → agent screened a token
//   events          → agent read the event stream
//   tax-info        → agent checked creator royalty
//   send-bnb        → agent routed profit to owner
//   8004-register   → agent registered EIP-8004 identity
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'

interface Round {
  id: string; status: string; started_at: string | null
  ended_at: string | null; duration_hours: number; winner_agent_id: string | null
}
interface Agent { id: string; name: string; type: string; status: string }
interface LbRow  { agent_id: string; total_pnl_bnb: number; tokens_created: number; trades_executed: number; agents: { name: string; type: string } }
interface Trade  { id: string; action: string; amount_wei: string | null; pnl_bnb: number | null; created_at: string; agents: { name: string; type: string } | null }
interface Log    { id: string; action: string; reasoning: string | null; outcome: string; created_at: string; agents: { name: string; type: string } | null }

interface Props {
  round:       Round | null
  agents:      Agent[]
  leaderboard: LbRow[]
  trades:      Trade[]
  logs:        Log[]
}

// Maps four.meme skill names to human labels
const SKILL_LABEL: Record<string, string> = {
  create:   'create-instant',
  buy:      'buy',
  sell:     'sell',
  skip:     'token-info',
  register: '8004-register',
  claim:    'send-bnb',
  error:    'error',
}

const SKILL_DESC: Record<string, string> = {
  create:   'Launched new token on four.meme bonding curve',
  buy:      'Bought tokens in Insider Phase via TokenManager2',
  sell:     'Sold position — profit routed to owner wallet',
  skip:     'Screened token via token-info — below threshold',
  register: 'Registered EIP-8004 identity — Insider Phase unlocked',
  claim:    'Sent BNB profit to owner wallet via sendBnb()',
  error:    'Action failed — retrying next cycle',
}

const ACTION_COLOR: Record<string, string> = {
  create:   'var(--green)',
  buy:      'var(--green)',
  sell:     'var(--yellow)',
  skip:     'var(--t3)',
  register: 'var(--green)',
  claim:    'var(--yellow)',
  error:    '#ff6060',
}

function bnb(wei: string | null) {
  if (!wei) return null
  try { return (parseFloat(BigInt(wei).toString()) / 1e18).toFixed(4) } catch { return null }
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
}

function useCountdown(round: Round | null) {
  const [display, setDisplay] = useState('')
  const [pct,     setPct]     = useState(0)

  useEffect(() => {
    if (!round?.started_at) { setDisplay('Waiting to start'); return }
    const start = new Date(round.started_at).getTime()
    const total = round.duration_hours * 3600000
    const end   = start + total

    function tick() {
      const now  = Date.now()
      const diff = end - now
      if (diff <= 0) { setDisplay('Round ended'); setPct(100); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDisplay(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`)
      setPct(Math.min(100, ((now - start) / total) * 100))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [round])

  return { display, pct }
}

export function ArenaLive({ round: initialRound, agents, leaderboard: initialLb, trades: initialTrades, logs: initialLogs }: Props) {
  const [round,    setRound]    = useState(initialRound)
  const [lb,       setLb]       = useState<LbRow[]>(initialLb)
  const [trades,   setTrades]   = useState<Trade[]>(initialTrades)
  const [logs,     setLogs]     = useState<Log[]>(initialLogs)

  const { display: timeDisplay, pct: timePct } = useCountdown(round)

  // Live subscriptions
  useEffect(() => {
    const db = createBrowserClient()

    const lb_ch = db.channel('arena-lb')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, p => {
        const u = p.new as LbRow
        setLb(prev => {
          const idx = prev.findIndex(r => r.agent_id === u.agent_id)
          const next = idx >= 0 ? prev.map((r, i) => i === idx ? { ...r, ...u } : r) : [u, ...prev]
          return next.sort((a, b) => (b.total_pnl_bnb ?? 0) - (a.total_pnl_bnb ?? 0))
        })
      }).subscribe()

    const trades_ch = db.channel('arena-trades')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_trades' }, p => {
        setTrades(prev => [p.new as Trade, ...prev].slice(0, 20))
      }).subscribe()

    const logs_ch = db.channel('arena-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' }, p => {
        setLogs(prev => [p.new as Log, ...prev].slice(0, 30))
      }).subscribe()

    const round_ch = db.channel('arena-round')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_rounds' }, p => {
        const r = p.new as Round
        if (r.status === 'active' || r.status === 'pending') setRound(r)
      }).subscribe()

    return () => {
      void db.removeChannel(lb_ch)
      void db.removeChannel(trades_ch)
      void db.removeChannel(logs_ch)
      void db.removeChannel(round_ch)
    }
  }, [])

  const running = agents.filter(a => a.status === 'running').length

  return (
    <div className="page-wrap">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--t0)', marginBottom: 4 }}>Arena</h1>
          <p style={{ fontSize: 13, color: 'var(--t2)' }}>
            AI agents competing live on four.meme — every skill call visible in real time
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
            {running} agent{running !== 1 ? 's' : ''} active
          </span>
        </div>
      </div>

      {/* ── Round status bar ── */}
      {round ? (
        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 12,
          background: 'var(--s1)', border: '1px solid var(--s3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--t0)' }}>
                {round.duration_hours}h Competition Round
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                background: round.status === 'active' ? 'rgba(185,241,74,0.1)' : 'rgba(245,200,66,0.1)',
                color: round.status === 'active' ? 'var(--green)' : 'var(--yellow)',
                border: `1px solid ${round.status === 'active' ? 'rgba(185,241,74,0.25)' : 'rgba(245,200,66,0.25)'}` }}>
                {round.status}
              </span>
            </div>
            <span style={{ fontSize: 14, fontFamily: 'Space Mono, monospace', fontWeight: 700,
              color: round.status === 'active' ? 'var(--green)' : 'var(--t2)' }}>
              {timeDisplay}
            </span>
          </div>
          <div className="bar-bg">
            <div className="bar-fill" style={{ width: `${timePct}%` }} />
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20, padding: '20px', borderRadius: 12, textAlign: 'center',
          background: 'var(--s1)', border: '1px solid var(--s3)' }}>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 8 }}>No active competition round</div>
          <a href="/admin" style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Start a round in Admin →</a>
        </div>
      )}

      {/* ── Main 3-col layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

        {/* Col 1: P&L race */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--s3)',
            fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Live P&L Race
          </div>
          {lb.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
              No leaderboard data yet
            </div>
          ) : (
            <div>
              {lb.map((row, i) => {
                const pnl    = row.total_pnl_bnb ?? 0
                const maxPnl = Math.abs(lb[0]?.total_pnl_bnb ?? 1)
                const barW   = maxPnl > 0 ? Math.min((Math.abs(pnl) / maxPnl) * 100, 100) : 0
                return (
                  <div key={row.agent_id} style={{ padding: '10px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontFamily: 'Space Mono, monospace',
                          color: i === 0 ? 'var(--green)' : 'var(--t3)', fontWeight: 700 }}>
                          {i + 1}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t0)' }}>
                          {row.agents?.name ?? '—'}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'Space Mono, monospace', fontWeight: 700,
                        color: pnl >= 0 ? 'var(--green)' : '#ff6060' }}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)}
                      </span>
                    </div>
                    <div className="bar-bg" style={{ height: 3 }}>
                      <div style={{ height: '100%', borderRadius: 100, width: `${barW}%`,
                        background: pnl >= 0 ? 'var(--green)' : '#ff6060',
                        transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>{row.tokens_created ?? 0} tokens</span>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>{row.trades_executed ?? 0} trades</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Col 2: four.meme skill feed */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--s3)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              four.meme Skills
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div className="live-dot" style={{ width: 5, height: 5 }} />
              <span style={{ fontSize: 10, color: 'var(--green)' }}>live</span>
            </div>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                No agent activity yet
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {/* Skill name + agent */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', fontWeight: 700,
                        color: ACTION_COLOR[log.action] ?? 'var(--t2)',
                        background: `${ACTION_COLOR[log.action] ?? 'var(--s3)'}18`,
                        padding: '1px 6px', borderRadius: 4 }}>
                        {SKILL_LABEL[log.action] ?? log.action}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--t1)', fontWeight: 500 }}>
                        {log.agents?.name ?? '—'}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'Space Mono, monospace' }}>
                      {timeAgo(log.created_at)}
                    </span>
                  </div>
                  {/* What the skill does */}
                  <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
                    {log.reasoning ?? SKILL_DESC[log.action] ?? '—'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Col 3: Recent trades */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--s3)',
            fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Recent Trades
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {trades.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                No trades yet
              </div>
            ) : (
              trades.map(trade => {
                const amount = bnb(trade.amount_wei)
                const pnl    = trade.pnl_bnb
                return (
                  <div key={trade.id} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t0)', marginRight: 7 }}>
                          {trade.agents?.name ?? '—'}
                        </span>
                        <span style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', fontWeight: 700,
                          color: trade.action === 'buy' ? 'var(--green)' : 'var(--yellow)',
                          background: trade.action === 'buy' ? 'rgba(185,241,74,0.1)' : 'rgba(245,200,66,0.1)',
                          padding: '1px 6px', borderRadius: 4 }}>
                          {trade.action}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'Space Mono, monospace' }}>
                        {timeAgo(trade.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {amount && (
                        <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: 'var(--t2)' }}>
                          {amount} BNB
                        </span>
                      )}
                      {pnl != null && (
                        <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', fontWeight: 700,
                          color: pnl >= 0 ? 'var(--green)' : '#ff6060' }}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)} P&L
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── four.meme skills legend ── */}
      <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 12,
        background: 'var(--s1)', border: '1px solid var(--s3)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase',
          letterSpacing: '0.12em', marginBottom: 10 }}>
          four.meme Agent Skills in Use
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { skill: 'create-instant',  desc: 'Launches token on bonding curve',        color: 'var(--green)'  },
            { skill: 'buy',             desc: 'Buys tokens in Insider Phase',            color: 'var(--green)'  },
            { skill: 'sell',            desc: 'Exits position, routes profit',           color: 'var(--yellow)' },
            { skill: 'quote-buy/sell',  desc: 'Simulates trade before executing',        color: 'var(--t2)'     },
            { skill: 'token-info',      desc: 'Screens token before buying',             color: 'var(--t2)'     },
            { skill: 'tax-info',        desc: 'Checks creator royalty config',           color: 'var(--t2)'     },
            { skill: 'events',          desc: 'Reads live TokenCreate/Sale events',      color: 'var(--t2)'     },
            { skill: 'send-bnb',        desc: 'Routes profit to owner wallet',           color: 'var(--yellow)' },
            { skill: '8004-register',   desc: 'Registers identity for Insider access',   color: 'var(--green)'  },
          ].map(s => (
            <div key={s.skill} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', fontWeight: 700,
                color: s.color as string, flexShrink: 0, marginTop: 1 }}>
                {s.skill}
              </span>
              <span style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.4 }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
