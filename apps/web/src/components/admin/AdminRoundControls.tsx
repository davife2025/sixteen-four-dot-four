'use client'
import { useState } from 'react'

interface Round { id: string; status: string; started_at: string|null; ended_at: string|null; duration_hours: number; prize_pool_bnb: number }

const STS_COLOR: Record<string,string> = { active:'var(--green)', pending:'var(--yellow)', ended:'var(--t3)' }

export function AdminRoundControls({ rounds: initial }: { rounds: Round[] }) {
  const [rounds,   setRounds]   = useState(initial)
  const [dur,      setDur]      = useState('24')
  const [loading,  setLoading]  = useState<string|null>(null)
  const [msg,      setMsg]      = useState<{ok:boolean;text:string}|null>(null)

  async function act(action: string, roundId?: string) {
    setLoading(action); setMsg(null)
    try {
      const res  = await fetch('/api/rounds', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action, round_id:roundId, duration_hours:parseInt(dur) }) })
      const data = await res.json() as { round?: Round; error?: string }
      if (res.ok && data.round) {
        setRounds(prev => { const idx = prev.findIndex(r => r.id===data.round!.id); if (idx>=0){ const n=[...prev]; n[idx]=data.round!; return n } return [data.round!,...prev] })
        setMsg({ ok:true, text:`Round ${action}d` })
      } else { setMsg({ ok:false, text:data.error??'Failed' }) }
    } finally { setLoading(null) }
  }

  const active  = rounds.find(r => r.status==='active')
  const pending = rounds.find(r => r.status==='pending')

  function elapsed(r: Round) {
    if (!r.started_at) return '—'
    const m = Math.floor((Date.now()-new Date(r.started_at).getTime())/60000)
    return m>60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`
  }

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {!active && !pending && (
          <>
            <select value={dur} onChange={e=>setDur(e.target.value)} className="input" style={{ width:'auto', padding:'5px 10px', fontSize:11 }}>
              {['1','6','12','24','48'].map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
            <button onClick={() => void act('create')} disabled={loading==='create'}
              style={{ fontSize:11, padding:'5px 12px', borderRadius:7, cursor:'pointer',
                background:'var(--s2)', border:'1px solid var(--s3)', color:'var(--green)' }}>
              {loading==='create'?'…':'+ Create'}
            </button>
          </>
        )}
        {pending && <button onClick={() => void act('start', pending.id)} disabled={loading==='start'}
          style={{ fontSize:11, padding:'5px 12px', borderRadius:7, cursor:'pointer',
            background:'var(--s2)', border:'1px solid var(--s3)', color:'var(--green)' }}>
          {loading==='start'?'…':'Start Round'}
        </button>}
        {active && <button onClick={() => void act('end', active.id)} disabled={loading==='end'}
          style={{ fontSize:11, padding:'5px 12px', borderRadius:7, cursor:'pointer',
            background:'var(--s2)', border:'1px solid var(--s3)', color:'#ff6060' }}>
          {loading==='end'?'…':'End Round'}
        </button>}
      </div>
      {msg && <div style={{ fontSize:11, padding:'6px 10px', borderRadius:7, marginBottom:10,
        background: msg.ok?'rgba(185,241,74,0.08)':'rgba(255,96,96,0.08)',
        color: msg.ok?'var(--green)':'#ff6060',
        border:`1px solid ${msg.ok?'rgba(185,241,74,0.2)':'rgba(255,96,96,0.2)'}` }}>{msg.text}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {rounds.slice(0,5).map(r => (
          <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'9px 12px', borderRadius:8, background:'var(--s2)', border:'1px solid var(--s3)' }}>
            <div>
              <div style={{ fontSize:11, fontFamily:'Space Mono,monospace', color:'var(--t3)', marginBottom:2 }}>{r.id.slice(0,10)}…</div>
              <div style={{ fontSize:12, color:'var(--t2)' }}>
                {r.duration_hours}h{r.status==='active'&&` · ${elapsed(r)} elapsed`}
              </div>
            </div>
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 10px', borderRadius:100,
              color:STS_COLOR[r.status]??'var(--t3)',
              background:`${STS_COLOR[r.status]??'var(--s3)'}18`,
              border:`1px solid ${STS_COLOR[r.status]??'var(--s3)'}44` }}>
              {r.status}
            </span>
          </div>
        ))}
        {!rounds.length && <div style={{ textAlign:'center', padding:'20px 0', fontSize:13, color:'var(--t3)' }}>No rounds yet</div>}
      </div>
    </div>
  )
}
