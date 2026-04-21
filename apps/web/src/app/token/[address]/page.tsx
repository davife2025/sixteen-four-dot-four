import { createServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TokenRisk } from '@/components/token/TokenRisk'

export const revalidate = 30

interface Props { params: { address: string } }

async function getToken(address: string) {
  const db = createServerClient()
  const { data } = await db.from('meme_tokens')
    .select('*, agents(name,type,wallet_address)')
    .eq('token_address', address).single()
  return data
}
async function getTrades(address: string) {
  const db = createServerClient()
  const { data } = await db.from('agent_trades')
    .select('id,action,amount_wei,pnl_bnb,created_at,agents(name)')
    .eq('token_address', address).order('created_at',{ascending:false}).limit(30)
  return data ?? []
}

function wei(w: string) { try { return (Number(BigInt(w))/1e18).toFixed(4) } catch { return '0.0000' } }

const PHASE_COLOR: Record<string,string> = { insider:'var(--yellow)', public:'var(--green)', graduated:'var(--t0)', pending:'var(--t3)' }

export default async function TokenPage({ params }: Props) {
  const [token, trades] = await Promise.all([getToken(params.address), getTrades(params.address)])
  if (!token) notFound()

  const curve   = token.bonding_curve_pct ?? 0
  const isClose = curve >= 80 && curve < 100
  const isGrad  = token.phase === 'graduated'

  return (
    <div className="page">
      <Link href="/feed" style={{ fontSize:13, color:'var(--t2)', display:'inline-flex', alignItems:'center', gap:4, marginBottom:16 }}>
        ← Token Feed
      </Link>

      {/* Graduation alert */}
      {isGrad && (
        <div style={{ padding:'14px 18px', borderRadius:10, background:'rgba(185,241,74,0.08)', border:'1px solid rgba(185,241,74,0.3)', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>🎓</span>
          <div>
            <div style={{ fontWeight:700, color:'var(--green)', fontSize:14 }}>Graduated to PancakeSwap!</div>
            <div style={{ fontSize:12, color:'var(--t2)', marginTop:2 }}>This token filled its bonding curve and is now trading on PancakeSwap with full liquidity.</div>
          </div>
          <a href={`https://pancakeswap.finance/swap?outputCurrency=${token.token_address}`} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ marginLeft:'auto', fontSize:12, padding:'8px 16px', flexShrink:0 }}>
            Trade on PancakeSwap ↗
          </a>
        </div>
      )}

      {/* Near-graduation alert */}
      {isClose && (
        <div style={{ padding:'12px 16px', borderRadius:10, background:'rgba(245,200,66,0.07)', border:'1px solid rgba(245,200,66,0.25)', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span className="live-dot" style={{ background:'var(--yellow)' }} />
          <span style={{ fontSize:13, color:'var(--yellow)', fontWeight:600 }}>
            {curve.toFixed(0)}% filled — graduating to PancakeSwap soon
          </span>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20, alignItems:'start' }}>

        {/* Left */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Media */}
          <div style={{ borderRadius:14, overflow:'hidden', background:'var(--s2)', border:'1px solid var(--s3)' }}>
            {token.asset_type === 'video' && token.video_url
              ? <video src={token.video_url} poster={token.image_url} controls style={{ width:'100%', display:'block', maxHeight:420 }} />
              : token.image_url
                ? <img src={token.image_url} alt={token.name} style={{ width:'100%', display:'block', maxHeight:420, objectFit:'contain' }} />
                : <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', fontSize:52, opacity:0.2 }}>🐸</div>}
          </div>

          {/* Info */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:24, color:'var(--t0)', marginBottom:4 }}>{token.name}</h1>
                <span style={{ fontFamily:'Space Mono,monospace', fontSize:13, color:'var(--green)' }}>${token.symbol}</span>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>Sixteen Score</div>
                <div style={{ fontFamily:'Space Mono,monospace', fontWeight:700, fontSize:26, color:'var(--green)' }}>
                  {Math.round(token.sixteen_score ?? 0)}
                </div>
              </div>
            </div>

            <p style={{ fontSize:14, color:'var(--t2)', lineHeight:1.7, marginBottom:16 }}>{token.description}</p>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
              {[
                { label:'Virality',  value:`${token.virality_score ?? 0}/100` },
                { label:'Phase',     value:token.phase, color:PHASE_COLOR[token.phase] },
                { label:'Category',  value:token.label },
              ].map(s => (
                <div key={s.label} style={{ padding:'12px', background:'var(--s2)', borderRadius:8, border:'1px solid var(--s3)' }}>
                  <div style={{ fontSize:10, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontFamily:'Space Mono,monospace', fontWeight:700, fontSize:13, color:s.color ?? 'var(--t0)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Bonding curve */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ fontSize:11, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Bonding Curve</span>
                <span style={{ fontFamily:'Space Mono,monospace', fontSize:12, color:curve>80?'var(--yellow)':'var(--green)' }}>{curve.toFixed(1)}%</span>
              </div>
              <div className="prog-bar"><div className="prog-fill" style={{ width:`${curve}%` }} /></div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>
                {curve >= 100 ? 'Graduated → PancakeSwap' : `${(100-curve).toFixed(1)}% until graduation`}
              </div>
            </div>

            {/* Creator */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:14, borderTop:'1px solid var(--s3)', fontSize:13 }}>
              <span style={{ color:'var(--t2)' }}>
                {token.agents ? <>By agent <strong style={{ color:'var(--t0)' }}>{token.agents.name}</strong></> : 'Community created'}
              </span>
              <a href={`https://testnet.bscscan.com/token/${token.token_address}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize:11, fontFamily:'Space Mono,monospace', color:'var(--green)' }}>
                {token.token_address?.slice(0,8)}…{token.token_address?.slice(-4)} ↗
              </a>
            </div>
          </div>

          {/* Fee breakdown */}
          <div className="card" style={{ padding:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>
              Fee Breakdown per Trade
            </div>
            {[
              { label:'Total fee',        value:`${token.tax_fee_rate ?? 5}%`,                 color:null },
              { label:'Creator royalty',  value:`${token.recipient_rate ?? 40}% of fee`,       color:'var(--green)' },
              { label:'Holder dividends', value:`${token.divide_rate ?? 40}% of fee`,          color:null },
              { label:'Burn',             value:`${token.burn_rate ?? 10}% of fee`,            color:null },
              { label:'Liquidity',        value:`${token.liquidity_rate ?? 10}% of fee`,       color:null },
            ].map((r,i,arr) => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.04)':'none', fontSize:13 }}>
                <span style={{ color:'var(--t2)' }}>{r.label}</span>
                <span style={{ fontFamily:'Space Mono,monospace', fontWeight:r.color?700:400, color:r.color??'var(--t1)' }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Kimi K2 Risk */}
          <div className="card" style={{ padding:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>
              Kimi K2 Risk Analysis
            </div>
            <TokenRisk token={token} />
          </div>

          {/* Trade history */}
          <div className="card">
            <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--s3)', fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
              Trade History
            </div>
            {trades.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', fontSize:13, color:'var(--t3)' }}>No trades yet</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Action</th><th>Agent</th><th style={{ textAlign:'right' }}>Amount</th><th style={{ textAlign:'right' }}>P&L</th><th style={{ textAlign:'right' }}>Time</th></tr></thead>
                <tbody>
                  {(trades as any[]).map(t => {
                    const pnl = t.pnl_bnb ?? 0
                    return (
                      <tr key={t.id}>
                        <td>
                          <span style={{ fontSize:10, fontWeight:700, fontFamily:'Space Mono,monospace', color:t.action==='buy'?'var(--green)':'var(--yellow)', background:t.action==='buy'?'rgba(185,241,74,0.1)':'rgba(245,200,66,0.1)', padding:'2px 7px', borderRadius:4 }}>
                            {t.action.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ color:'var(--t1)' }}>{t.agents?.name ?? '—'}</td>
                        <td style={{ textAlign:'right', fontFamily:'Space Mono,monospace', fontSize:12, color:'var(--t2)' }}>{wei(t.amount_wei ?? '0')} BNB</td>
                        <td style={{ textAlign:'right', fontFamily:'Space Mono,monospace', fontSize:12, fontWeight:700, color:pnl>=0?'var(--green)':'var(--red)' }}>
                          {pnl !== 0 ? `${pnl>=0?'+':''}${pnl.toFixed(4)}` : '—'}
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

        {/* Right sidebar */}
        <div style={{ position:'sticky', top:68, display:'flex', flexDirection:'column', gap:12 }}>
          <div className="card" style={{ padding:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Token Info</div>
            {[
              { label:'Contract', value:`${token.token_address?.slice(0,10)}…${token.token_address?.slice(-6)}`, mono:true },
              { label:'Network',  value:'BNB Testnet (97)' },
              { label:'Standard', value:'BEP-20 TaxToken' },
              { label:'Launched', value:new Date(token.created_at).toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric'}) },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:13 }}>
                <span style={{ color:'var(--t2)' }}>{r.label}</span>
                <span style={{ fontFamily:r.mono?'Space Mono,monospace':'inherit', fontSize:r.mono?11:13, color:'var(--t1)' }}>{r.value}</span>
              </div>
            ))}
          </div>

          <a href={`https://four.meme/token/${token.token_address}`} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display:'flex', justifyContent:'center', fontSize:13 }}>
            Trade on four.meme ↗
          </a>
          {isGrad && (
            <a href={`https://pancakeswap.finance/swap?outputCurrency=${token.token_address}`} target="_blank" rel="noopener noreferrer" className="btn-yellow" style={{ display:'flex', justifyContent:'center', fontSize:13 }}>
              Trade on PancakeSwap ↗
            </a>
          )}
          <a href={`https://testnet.bscscan.com/token/${token.token_address}`} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ display:'flex', justifyContent:'center', fontSize:13 }}>
            View on BscScan ↗
          </a>
          <Link href="/earnings" className="btn-secondary" style={{ display:'flex', justifyContent:'center', fontSize:13 }}>
            Check Earnings
          </Link>
        </div>
      </div>
    </div>
  )
}
