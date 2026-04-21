import { createServerClient } from '@/lib/supabase'
import { TokenFeed } from '@/components/feed/TokenFeed'
import Link from 'next/link'

export const revalidate = 30
export const metadata = { title: 'Token Feed | Sixteen' }

async function getData() {
  const db = createServerClient()
  const [tokensRes, counts] = await Promise.allSettled([
    db.from('meme_tokens').select('*, agents(name,type)').order('sixteen_score', { ascending: false }).limit(50),
    Promise.all([
      db.from('meme_tokens').select('id', { count: 'exact', head: true }),
      db.from('agents').select('id', { count: 'exact', head: true }).eq('status', 'running'),
      db.from('agent_trades').select('id', { count: 'exact', head: true }),
    ])
  ])
  const tokens = tokensRes.status === 'fulfilled' ? (tokensRes.value.data ?? []) : []
  const [t, a, tr] = counts.status === 'fulfilled' ? counts.value : [{ count: 0 }, { count: 0 }, { count: 0 }]
  return { tokens, stats: { tokens: t.count ?? 0, agents: a.count ?? 0, trades: tr.count ?? 0 } }
}

export default async function FeedPage() {
  const { tokens, stats } = await getData()
  return (
    <div className="page">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:22, color:'var(--t0)', marginBottom:4 }}>Token Feed</h1>
          <p style={{ fontSize:13, color:'var(--t2)' }}>All tokens launched by humans and AI agents — sorted by score</p>
        </div>
        <Link href="/" className="btn-g" style={{ fontSize:13, padding:'9px 18px' }}>+ Create Token</Link>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Tokens Launched', value: stats.tokens },
          { label:'AI Agents Live',  value: stats.agents },
          { label:'Total Trades',    value: stats.trades },
        ].map(s => (
          <div key={s.label} style={{ padding:'14px 18px', background:'var(--s1)', border:'1px solid var(--s3)', borderRadius:10 }}>
            <div style={{ fontFamily:'Space Mono,monospace', fontWeight:700, fontSize:22, color:'var(--t0)', lineHeight:1, marginBottom:5 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <TokenFeed initialTokens={tokens} />
    </div>
  )
}
