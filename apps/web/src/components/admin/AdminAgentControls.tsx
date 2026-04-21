'use client'
import { useState } from 'react'

interface Agent { id: string; name: string; type: string; status: string; wallet_address: string; eip8004_token_id: string | null }

const STS_DOT: Record<string,string> = { running:'var(--green)', idle:'var(--s3)', paused:'var(--yellow)', error:'#ff6060' }

export function AdminAgentControls({ agents }: { agents: Agent[] }) {
  const [sts,     setSts]     = useState<Record<string,string>>(Object.fromEntries(agents.map(a => [a.id, a.status])))
  const [loading, setLoading] = useState<string|null>(null)
  const [msg,     setMsg]     = useState<{ok:boolean;text:string}|null>(null)

  async function setStatus(id: string, status: string) {
    setLoading(id)
    try {
      const res = await fetch(`/api/agents/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status }) })
      if (res.ok) setSts(p => ({ ...p, [id]: status }))
      else setMsg({ ok:false, text:'Update failed' })
    } finally { setLoading(null) }
  }

  if (!agents.length) return (
    <div style={{ textAlign:'center', padding:'24px 0', fontSize:13, color:'var(--t3)' }}>No agents — create one from Dashboard</div>
  )

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {(['running','idle'] as const).map(s => (
          <button key={s} onClick={() => { agents.forEach(a => void setStatus(a.id, s)); setMsg({ ok:true, text:`All set to ${s}` }) }}
            style={{ fontSize:11, padding:'5px 12px', borderRadius:7, cursor:'pointer',
              background:'var(--s2)', border:'1px solid var(--s3)',
              color: s==='running' ? 'var(--green)' : '#ff6060' }}>
            {s==='running' ? 'Start All' : 'Stop All'}
          </button>
        ))}
      </div>
      {msg && (
        <div style={{ fontSize:11, padding:'6px 10px', borderRadius:7, marginBottom:10,
          background: msg.ok ? 'rgba(185,241,74,0.08)' : 'rgba(255,96,96,0.08)',
          color: msg.ok ? 'var(--green)' : '#ff6060',
          border: `1px solid ${msg.ok ? 'rgba(185,241,74,0.2)' : 'rgba(255,96,96,0.2)'}` }}>
          {msg.text}
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {agents.map(a => {
          const s = sts[a.id] ?? a.status
          return (
            <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
              borderRadius:8, background:'var(--s2)', border:'1px solid var(--s3)' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:STS_DOT[s]??'var(--s3)', flexShrink:0,
                boxShadow: s==='running' ? '0 0 5px var(--green)' : 'none' }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, color:'var(--t0)', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                <div style={{ display:'flex', gap:8, marginTop:2 }}>
                  <span style={{ fontSize:10, color:'var(--green)' }}>{a.type}</span>
                  <span style={{ fontSize:10, color:'var(--t3)', fontFamily:'Space Mono,monospace' }}>{a.wallet_address?.slice(0,8)}…</span>
                  {a.eip8004_token_id && <span style={{ fontSize:10, color:'var(--green)' }}>EIP-8004</span>}
                </div>
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:STS_DOT[s]??'var(--t3)' }}>{s}</span>
              <button onClick={() => void setStatus(a.id, s==='running'?'idle':'running')} disabled={loading===a.id}
                style={{ fontSize:11, padding:'4px 10px', borderRadius:6, cursor:'pointer',
                  background:'var(--s1)', border:'1px solid var(--s3)',
                  color: s==='running' ? '#ff6060' : 'var(--green)',
                  opacity: loading===a.id ? 0.5 : 1 }}>
                {loading===a.id ? '…' : s==='running' ? 'Stop' : 'Start'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
