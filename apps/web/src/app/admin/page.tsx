import { createServerClient } from '@/lib/supabase'
import { AdminAgentControls } from '@/components/admin/AdminAgentControls'
import { AdminRoundControls  } from '@/components/admin/AdminRoundControls'
import { AdminErrorLog       } from '@/components/admin/AdminErrorLog'

export const metadata = { title: 'Admin | Sixteen' }
export const revalidate = 0

async function getData() {
  const db = createServerClient()
  const [agentsRes, roundsRes, errorsRes, configRes] = await Promise.allSettled([
    db.from('agents').select('id, name, type, status, wallet_address, eip8004_token_id, created_at').order('created_at', { ascending: false }),
    db.from('competition_rounds').select('id, status, started_at, ended_at, duration_hours, prize_pool_bnb').order('created_at', { ascending: false }).limit(10),
    db.from('agent_errors').select('id, error_type, message, context, created_at, agents(name)').order('created_at', { ascending: false }).limit(50),
    db.from('platform_config').select('key, value, updated_at'),
  ])
  return {
    agents: agentsRes.status === 'fulfilled' ? (agentsRes.value.data ?? []) : [],
    rounds: roundsRes.status === 'fulfilled' ? (roundsRes.value.data ?? []) : [],
    errors: errorsRes.status === 'fulfilled'
      ? (errorsRes.value.data ?? []).map((e: any) => ({
          ...e,
          agents: Array.isArray(e.agents) ? e.agents[0] ?? null : e.agents,
        }))
      : [],
    config: configRes.status === 'fulfilled' ? (configRes.value.data ?? []) : [],
  }
}

export default async function AdminPage() {
  const { agents, rounds, errors, config } = await getData()

  const running     = agents.filter((a: any) => a.status === 'running').length
  const errored     = agents.filter((a: any) => a.status === 'error').length
  const activeRound = (rounds as any[]).find(r => r.status === 'active')

  return (
    <div className="page-wrap">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:22, color:'var(--t0)', marginBottom:4 }}>Admin</h1>
          <p style={{ fontSize:13, color:'var(--t2)' }}>BNB Testnet (chainId 97) — internal controls</p>
        </div>
        <span style={{ fontSize:10, fontWeight:700, padding:'4px 12px', borderRadius:100,
          background:'rgba(245,200,66,0.1)', color:'var(--yellow)', border:'1px solid rgba(245,200,66,0.25)' }}>
          Testnet
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Total Agents',  value: agents.length,          color:'var(--t0)'    },
          { label:'Running',       value: running,                 color:'var(--green)' },
          { label:'Errors',        value: errored,                 color: errored>0?'#ff6060':'var(--t3)' },
          { label:'Active Round',  value: activeRound ? '1' : '0', color: activeRound?'var(--yellow)':'var(--t3)' },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ padding:'14px 16px' }}>
            <div className="kpi-val" style={{ fontSize:22, color: k.color }}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Controls grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--t0)', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            Agent Controls
          </div>
          <AdminAgentControls agents={agents} />
        </div>
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--t0)', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            Competition Rounds
          </div>
          <AdminRoundControls rounds={rounds} />
        </div>
      </div>

      {/* Platform config */}
      {config.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--s3)',
            fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
            Platform Config
          </div>
          <table className="tbl">
            <thead><tr><th>Key</th><th>Value</th><th>Updated</th></tr></thead>
            <tbody>
              {(config as any[]).map(row => (
                <tr key={row.key}>
                  <td style={{ fontFamily:'Space Mono,monospace', fontSize:11, color:'var(--green)' }}>{row.key}</td>
                  <td style={{ fontFamily:'Space Mono,monospace', fontSize:11 }}>{JSON.stringify(row.value).replace(/^"|"$/g,'')}</td>
                  <td style={{ fontSize:11, color:'var(--t3)' }}>{new Date(row.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Error log */}
      <div className="card">
        <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--s3)',
          display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
            Error Log
          </span>
          {errors.length > 0 && (
            <span style={{ fontSize:10, fontWeight:700, padding:'1px 8px', borderRadius:100,
              background:'rgba(255,96,96,0.1)', color:'#ff6060', border:'1px solid rgba(255,96,96,0.25)' }}>
              {errors.length}
            </span>
          )}
        </div>
        <AdminErrorLog errors={errors} />
      </div>
    </div>
  )
}