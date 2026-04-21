'use client'
import { useState } from 'react'

interface ErrorRow { id: string; error_type: string; message: string; context: Record<string,unknown>; created_at: string; agents: { name: string } | null }

export function AdminErrorLog({ errors }: { errors: ErrorRow[] }) {
  const [expanded, setExpanded] = useState<string|null>(null)
  if (!errors.length) return (
    <div style={{ padding:'32px', textAlign:'center', fontSize:13, color:'var(--green)' }}>
      All clear — no errors logged
    </div>
  )
  return (
    <div>
      {errors.map((err, i) => (
        <div key={err.id} style={{ borderBottom: i<errors.length-1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
          <button onClick={() => setExpanded(expanded===err.id?null:err.id)}
            style={{ width:'100%', textAlign:'left', padding:'11px 18px', background:'none', border:'none', cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
              <span style={{ color:'#ff6060', fontSize:13, marginTop:1, flexShrink:0 }}>✗</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, fontFamily:'Space Mono,monospace', fontWeight:700,
                    color:'#ff6060', background:'rgba(255,96,96,0.1)', padding:'1px 7px', borderRadius:4 }}>
                    {err.error_type}
                  </span>
                  {err.agents && <span style={{ fontSize:11, color:'var(--t2)' }}>{err.agents.name}</span>}
                  <span style={{ fontSize:10, color:'var(--t3)', marginLeft:'auto', fontFamily:'Space Mono,monospace' }}>
                    {new Date(err.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize:13, color:'var(--t1)', marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {err.message}
                </div>
              </div>
              <span style={{ fontSize:11, color:'var(--t3)', flexShrink:0 }}>{expanded===err.id?'▲':'▼'}</span>
            </div>
          </button>
          {expanded===err.id && err.context && Object.keys(err.context).length>0 && (
            <div style={{ padding:'0 18px 12px 42px' }}>
              <pre style={{ fontSize:11, fontFamily:'Space Mono,monospace', color:'var(--t2)',
                background:'var(--s0)', borderRadius:8, padding:12, overflowX:'auto', border:'1px solid var(--s3)' }}>
                {JSON.stringify(err.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
