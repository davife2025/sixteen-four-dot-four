'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TYPES = [
  { id:'creator', label:'Creator',  desc:'Spots trends, generates memes with AI, launches tokens on four.meme. Best for earning royalties.' },
  { id:'trader',  label:'Trader',   desc:'Reads four.meme event stream, buys tokens early in Insider Phase, exits at +30% profit.' },
  { id:'hybrid',  label:'Hybrid',   desc:'Does both. Creates every 4th cycle, trades the rest. Recommended for most users.' },
]

export function CreateAgentForm() {
  const router = useRouter()
  const [name,   setName]   = useState('')
  const [type,   setType]   = useState('hybrid')
  const [wallet, setWallet] = useState('')
  const [agent,  setAgent]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [done,   setDone]   = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !wallet.trim() || !agent.trim()) {
      setError('All fields are required')
      return
    }
    if (!wallet.startsWith('0x') || !agent.startsWith('0x')) {
      setError('Wallet addresses must start with 0x')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, owner_wallet: wallet.trim(), wallet_address: agent.trim() }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok || data.error) { setError(data.error ?? 'Failed to create agent'); return }
      setDone(true)
      setTimeout(() => router.push('/admin'), 1500)
    } catch { setError('Network error — try again') }
    finally { setSaving(false) }
  }

  if (done) return (
    <div style={{ padding:'32px', textAlign:'center' }}>
      <div style={{ fontSize:28, marginBottom:12 }}>✓</div>
      <div style={{ fontWeight:700, color:'var(--green)', fontSize:16 }}>Agent created!</div>
      <div style={{ fontSize:13, color:'var(--t2)', marginTop:6 }}>Redirecting to Admin to start it…</div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Name */}
      <div>
        <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.09em', fontWeight:700 }}>
          Agent Name *
        </label>
        <input className="input" placeholder="e.g. MemeBot Alpha" value={name} onChange={e => setName(e.target.value)} />
      </div>

      {/* Type */}
      <div>
        <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.09em', fontWeight:700 }}>
          Agent Type *
        </label>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px', borderRadius:9, cursor:'pointer', textAlign:'left', background:type===t.id?'rgba(185,241,74,0.06)':'var(--s2)', border:`1.5px solid ${type===t.id?'var(--green)':'var(--s3)'}`, transition:'all 0.12s' }}>
              <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${type===t.id?'var(--green)':'var(--t3)'}`, background:type===t.id?'var(--green)':'transparent', flexShrink:0, marginTop:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {type===t.id && <div style={{ width:6, height:6, borderRadius:'50%', background:'#000' }} />}
              </div>
              <div>
                <div style={{ fontWeight:700, color:'var(--t0)', fontSize:13, marginBottom:3 }}>{t.label}</div>
                <div style={{ fontSize:12, color:'var(--t2)', lineHeight:1.5 }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Owner wallet */}
      <div>
        <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.09em', fontWeight:700 }}>
          Your Wallet — receives profits *
        </label>
        <input className="input" placeholder="0x… your personal wallet" value={wallet} onChange={e => setWallet(e.target.value)} style={{ fontFamily:'Space Mono,monospace', fontSize:12 }} />
        <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Profits are automatically sent here after each trade.</div>
      </div>

      {/* Agent wallet */}
      <div>
        <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.09em', fontWeight:700 }}>
          Agent Wallet — funds trades *
        </label>
        <input className="input" placeholder="0x… dedicated agent wallet" value={agent} onChange={e => setAgent(e.target.value)} style={{ fontFamily:'Space Mono,monospace', fontSize:12 }} />
        <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Separate dedicated wallet, funded with tBNB for gas and trades. Private key goes in Render env vars.</div>
      </div>

      {/* Note about running */}
      <div style={{ padding:'12px 14px', borderRadius:8, background:'rgba(245,200,66,0.06)', border:'1px solid rgba(245,200,66,0.2)', fontSize:12, color:'var(--t2)', lineHeight:1.6 }}>
        <strong style={{ color:'var(--yellow)' }}>Important:</strong> Creating an agent here sets it up in the database. To actually run it, deploy the agent engine to Render (see{' '}
        <a href="/onboarding" style={{ color:'var(--yellow)' }}>Setup Guide</a>), then start it in{' '}
        <a href="/admin" style={{ color:'var(--yellow)' }}>Admin</a>.
      </div>

      {error && (
        <div style={{ padding:'10px 14px', borderRadius:8, fontSize:13, color:'var(--red)', background:'rgba(255,85,85,0.07)', border:'1px solid rgba(255,85,85,0.2)' }}>
          {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={saving} className="btn-primary" style={{ fontSize:14, padding:'13px' }}>
        {saving ? 'Creating agent…' : 'Create Agent'}
      </button>
    </div>
  )
}
