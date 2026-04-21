import { createServerClient } from '@/lib/supabase'
import Link from 'next/link'
import { CreateAgentForm } from '@/components/agents/CreateAgentForm'

export const revalidate = 15
export const metadata = { title: 'My Agents | Sixteen' }

async function getData() {
  const db = createServerClient()
  const { data } = await db.from('agents')
    .select('*, leaderboard(total_pnl_bnb,tokens_created,trades_executed,rank)')
    .order('created_at', { ascending: false })
  return data ?? []
}

const TYPE_COLOR: Record<string,string> = { creator:'var(--green)', trader:'var(--yellow)', hybrid:'var(--t0)' }
const STS_DOT:   Record<string,string>  = { running:'var(--green)', idle:'var(--t3)', paused:'var(--yellow)', error:'var(--red)' }

export default async function AgentsPage() {
  const agents   = await getData()
  const running  = agents.filter((a:any) => a.status === 'running').length
  const totalPnl = agents.reduce((s:number, a:any) => {
    const lb = Array.isArray(a.leaderboard) ? a.leaderboard[0] : a.leaderboard
    return s + (lb?.total_pnl_bnb ?? 0)
  }, 0)

  return (
    <div className="page">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:22, color:'var(--t0)', marginBottom:4 }}>My Agents</h1>
          <p style={{ fontSize:13, color:'var(--t2)' }}>Each agent creates tokens and trades on four.meme — profits sent to your wallet.</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
        {[
          { label:'Total Agents',  value:agents.length, color:'var(--t0)' },
          { label:'Running Now',   value:running, color:running>0?'var(--green)':'var(--t3)' },
          { label:'Net P&L (BNB)', value:`${totalPnl>=0?'+':''}${totalPnl.toFixed(4)}`, color:totalPnl>=0?'var(--green)':'var(--red)' },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-val" style={{ color:k.color }}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:20, alignItems:'start' }}>
        {/* Agent cards */}
        <div>
          {agents.length === 0 ? (
            <div className="card" style={{ padding:'52px 32px', textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:14, opacity:0.4 }}>🤖</div>
              <div style={{ fontWeight:700, color:'var(--t0)', fontSize:15, marginBottom:8 }}>No agents yet</div>
              <div style={{ fontSize:13, color:'var(--t2)', marginBottom:20 }}>Create your first agent using the form. It will start creating tokens and trading within 2 minutes of being started.</div>
              <Link href="/onboarding" className="btn-secondary" style={{ fontSize:13 }}>Read Setup Guide first</Link>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(agents as any[]).map(agent => {
                const lb  = Array.isArray(agent.leaderboard) ? agent.leaderboard[0] : agent.leaderboard
                const pnl = lb?.total_pnl_bnb ?? 0
                return (
                  <div key={agent.id} className="card" style={{ padding:'16px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                          <span style={{ fontWeight:700, color:'var(--t0)', fontSize:15 }}>{agent.name}</span>
                          <span style={{ fontSize:10, fontWeight:700, color:TYPE_COLOR[agent.type]??'var(--t2)', background:`${TYPE_COLOR[agent.type]??'var(--s3)'}15`, border:`1px solid ${TYPE_COLOR[agent.type]??'var(--s3)'}30`, padding:'2px 8px', borderRadius:100 }}>
                            {agent.type}
                          </span>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background:STS_DOT[agent.status]??'var(--t3)', display:'inline-block', boxShadow:agent.status==='running'?`0 0 5px var(--green)`:undefined }} />
                            <span style={{ fontSize:11, color:STS_DOT[agent.status]??'var(--t3)' }}>{agent.status}</span>
                          </div>
                        </div>
                        <div style={{ fontFamily:'Space Mono,monospace', fontSize:10, color:'var(--t3)' }}>
                          {agent.wallet_address?.slice(0,12)}…{agent.wallet_address?.slice(-6)}
                        </div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, textAlign:'center' }}>
                        {[
                          { label:'P&L',    value:`${pnl>=0?'+':''}${pnl.toFixed(3)}`, color:pnl>=0?'var(--green)':'var(--red)' },
                          { label:'Tokens', value:lb?.tokens_created??0, color:'var(--t0)' },
                          { label:'Trades', value:lb?.trades_executed??0, color:'var(--t0)' },
                        ].map(s => (
                          <div key={s.label} style={{ background:'var(--s2)', borderRadius:8, padding:'8px' }}>
                            <div style={{ fontFamily:'Space Mono,monospace', fontWeight:700, fontSize:13, color:s.color }}>{s.value}</div>
                            <div style={{ fontSize:9, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.1em', marginTop:3 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {agent.eip8004_token_id && (
                        <div className="badge badge-green" style={{ flexShrink:0 }}>EIP-8004</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Create form */}
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontWeight:700, color:'var(--t0)', fontSize:15, marginBottom:16 }}>Create New Agent</div>
          <CreateAgentForm />
        </div>
      </div>
    </div>
  )
}
