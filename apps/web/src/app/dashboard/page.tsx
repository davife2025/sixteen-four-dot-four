import { createServerClient } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 0
export const metadata = { title: 'Dashboard | Sixteen' }

async function getData() {
  const db = createServerClient()
  const [agents, tokens, trades, round] = await Promise.allSettled([
    db.from('agents').select('*').order('created_at',{ascending:false}),
    db.from('meme_tokens').select('id,name,symbol,phase,bonding_curve_pct,created_at,agents(name)').order('created_at',{ascending:false}).limit(6),
    db.from('agent_trades').select('id,action,amount_wei,pnl_bnb,created_at,agents(name)').order('created_at',{ascending:false}).limit(8),
    db.from('competition_rounds').select('*').eq('status','active').single(),
  ])
  return {
    agents: agents.status==='fulfilled' ? (agents.value.data??[]) : [],
    tokens: tokens.status==='fulfilled' ? (tokens.value.data??[]) : [],
    trades: trades.status==='fulfilled' ? (trades.value.data??[]) : [],
    round:  round.status==='fulfilled'  ? (round.value.data??null) : null,
  }
}

function bnb(wei: string|null) {
  if (!wei) return '0.0000'
  try { return (Number(BigInt(wei))/1e18).toFixed(4) } catch { return '0.0000' }
}

const STS: Record<string,[string,string]> = {
  running: ['var(--green)','running'],
  idle:    ['var(--t3)','idle'],
  paused:  ['var(--yellow)','paused'],
  error:   ['var(--red)','error'],
}
const PHASE: Record<string,string> = { insider:'var(--yellow)', public:'var(--green)', graduated:'var(--t0)', pending:'var(--t3)' }

export default async function DashboardPage() {
  const { agents, tokens, trades, round } = await getData()
  const running  = (agents as any[]).filter(a=>a.status==='running').length
  const errored  = (agents as any[]).filter(a=>a.status==='error').length
  const totalPnl = (trades as any[]).reduce((s,t) => s+(t.pnl_bnb??0), 0)
  const hasAgents = agents.length > 0

  return (
    <div className="page">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:22, color:'var(--t0)', marginBottom:4 }}>Dashboard</h1>
          <p style={{ fontSize:13, color:'var(--t2)' }}>Your agents, tokens, and earnings</p>
        </div>
        <Link href="/" className="btn-g" style={{ fontSize:13 }}>+ Create Token</Link>
      </div>

      {/* Empty state */}
      {!hasAgents && (
        <div style={{ padding:'36px 28px', borderRadius:14, background:'rgba(185,241,74,0.04)', border:'1px solid rgba(185,241,74,0.14)', marginBottom:24, display:'flex', alignItems:'center', gap:24 }}>
          <div style={{ fontSize:42, flexShrink:0 }}>🤖</div>
          <div>
            <div style={{ fontWeight:700, color:'var(--t0)', fontSize:15, marginBottom:5 }}>No agents deployed yet</div>
            <div style={{ fontSize:13, color:'var(--t2)', lineHeight:1.65, marginBottom:14, maxWidth:400 }}>
              Deploy an AI agent and it will create meme tokens, trade on four.meme, and send profits to your wallet — every 2 minutes, automatically.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <Link href="/onboarding" className="btn-g" style={{ fontSize:13, padding:'8px 18px' }}>Get Started</Link>
              <Link href="/how-it-works" className="btn-o" style={{ fontSize:13 }}>How it works</Link>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Total Agents',    value: agents.length,  color:'var(--t0)' },
          { label:'Running Now',     value: running,        color: running>0?'var(--green)':'var(--t3)' },
          { label:'Tokens Launched', value: tokens.length,  color:'var(--t0)' },
          { label:'Net P&L',         value:`${totalPnl>=0?'+':''}${totalPnl.toFixed(4)} BNB`, color: totalPnl>=0?'var(--green)':'var(--red)' },
        ].map(k => (
          <div key={k.label} style={{ padding:'16px 18px', background:'var(--s1)', border:'1px solid var(--s3)', borderRadius:12 }}>
            <div style={{ fontFamily:'Space Mono,monospace', fontWeight:700, fontSize:22, color:k.color, lineHeight:1, marginBottom:5 }}>{k.value}</div>
            <div style={{ fontSize:11, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Active round banner */}
      {round && (
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 18px', borderRadius:10, background:'rgba(245,200,66,0.06)', border:'1px solid rgba(245,200,66,0.2)', marginBottom:20 }}>
          <div className="live-dot" style={{ background:'var(--yellow)' }} />
          <div style={{ flex:1 }}>
            <span style={{ fontWeight:600, color:'var(--yellow)', fontSize:13 }}>Competition round active</span>
            <span style={{ fontSize:12, color:'var(--t2)', marginLeft:8 }}>{(round as any).duration_hours}h round</span>
          </div>
          <Link href="/arena" className="btn-y" style={{ fontSize:12, padding:'6px 14px' }}>View Arena →</Link>
        </div>
      )}

      {/* Agents + tokens */}
      <div style={{ display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:14, marginBottom:14 }}>
        {/* Agents */}
        <div className="box">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderBottom:'1px solid var(--s3)' }}>
            <span style={{ fontWeight:700, color:'var(--t0)', fontSize:14 }}>Your Agents</span>
            <Link href="/agents" style={{ fontSize:12, color:'var(--green)' }}>All agents →</Link>
          </div>
          {(agents as any[]).length === 0 ? (
            <div style={{ padding:'32px', textAlign:'center', fontSize:13, color:'var(--t3)' }}>
              No agents — <Link href="/onboarding" style={{ color:'var(--green)' }}>deploy one →</Link>
            </div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Agent</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {(agents as any[]).map(a => {
                  const [color, label] = STS[a.status] ?? ['var(--t3)','—']
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight:600, color:'var(--t0)' }}>{a.name}</td>
                      <td style={{ fontSize:11, fontWeight:700, color:'var(--green)' }}>{a.type}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block', boxShadow: a.status==='running'?`0 0 5px ${color}`:'none' }} />
                          <span style={{ fontSize:12, color }}>{label}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent tokens */}
        <div className="box">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderBottom:'1px solid var(--s3)' }}>
            <span style={{ fontWeight:700, color:'var(--t0)', fontSize:14 }}>Recent Launches</span>
            <Link href="/feed" style={{ fontSize:12, color:'var(--green)' }}>Feed →</Link>
          </div>
          {(tokens as any[]).length === 0 ? (
            <div style={{ padding:'32px', textAlign:'center', fontSize:13, color:'var(--t3)' }}>No tokens yet</div>
          ) : (
            <div>
              {(tokens as any[]).map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 18px', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <div style={{ fontWeight:600, color:'var(--t0)', fontSize:13 }}>{t.name}</div>
                    <div style={{ fontSize:10, fontFamily:'Space Mono,monospace', color:'var(--t3)' }}>{t.symbol}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100, color:PHASE[t.phase]??'var(--t3)', background:`${PHASE[t.phase]??'var(--s3)'}15`, border:`1px solid ${PHASE[t.phase]??'var(--s3)'}33` }}>
                      {t.phase}
                    </span>
                    <div style={{ marginTop:4 }}>
                      <div style={{ width:60, height:3, background:'var(--s3)', borderRadius:100, overflow:'hidden', marginLeft:'auto' }}>
                        <div style={{ height:'100%', background:'linear-gradient(90deg,var(--green),var(--yellow))', width:`${t.bonding_curve_pct??0}%`, borderRadius:100 }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trade history */}
      <div className="box">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderBottom:'1px solid var(--s3)' }}>
          <span style={{ fontWeight:700, color:'var(--t0)', fontSize:14 }}>Recent Trades</span>
          <Link href="/logs" style={{ fontSize:12, color:'var(--green)' }}>Full logs →</Link>
        </div>
        {(trades as any[]).length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', fontSize:13, color:'var(--t3)' }}>No trades yet — start an agent to begin</div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Agent</th><th>Action</th><th style={{ textAlign:'right' }}>Amount</th><th style={{ textAlign:'right' }}>P&L</th><th style={{ textAlign:'right' }}>Time</th></tr></thead>
            <tbody>
              {(trades as any[]).map(t => {
                const pnl = t.pnl_bnb ?? 0
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight:600, color:'var(--t0)' }}>{t.agents?.name ?? '—'}</td>
                    <td>
                      <span style={{ fontSize:10, fontFamily:'Space Mono,monospace', fontWeight:700, color: t.action==='buy'?'var(--green)':'var(--yellow)', background: t.action==='buy'?'rgba(185,241,74,0.1)':'rgba(245,200,66,0.1)', padding:'2px 7px', borderRadius:4 }}>
                        {t.action}
                      </span>
                    </td>
                    <td style={{ textAlign:'right', fontFamily:'Space Mono,monospace', fontSize:12, color:'var(--t2)' }}>{bnb(t.amount_wei)} BNB</td>
                    <td style={{ textAlign:'right', fontFamily:'Space Mono,monospace', fontSize:12, fontWeight:700, color: pnl>=0?'var(--green)':'var(--red)' }}>
                      {pnl!==0 ? `${pnl>=0?'+':''}${pnl.toFixed(4)}` : '—'}
                    </td>
                    <td style={{ textAlign:'right', fontSize:11, color:'var(--t3)' }}>{new Date(t.created_at).toLocaleTimeString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
