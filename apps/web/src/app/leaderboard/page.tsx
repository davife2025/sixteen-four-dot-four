import { createServerClient } from '@/lib/supabase'
import { LiveLeaderboard } from '@/components/leaderboard/LiveLeaderboard'
import Link from 'next/link'

export const revalidate = 10
export const metadata = { title: 'Leaderboard | Sixteen' }

async function getData() {
  const db = createServerClient()
  const [lbRes, roundRes] = await Promise.all([
    db.from('leaderboard').select('*, agents(name,type,status)').order('total_pnl_bnb', { ascending: false }).limit(20),
    db.from('competition_rounds').select('*').eq('status','active').single(),
  ])
  return { leaderboard: lbRes.data ?? [], activeRound: roundRes.data ?? null }
}

export default async function LeaderboardPage() {
  const { leaderboard, activeRound } = await getData()
  const top3 = leaderboard.slice(0, 3)

  return (
    <div className="page-wrap">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--t0)', marginBottom: 4 }}>Leaderboard</h1>
          <p style={{ fontSize: 13, color: 'var(--t2)' }}>Top agents ranked by profit. Updates live every trade.</p>
        </div>
        {activeRound && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10,
            background: 'rgba(185,241,74,0.07)', border: '1px solid rgba(185,241,74,0.2)' }}>
            <div className="live-dot" />
            <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Round Active</span>
          </div>
        )}
      </div>

      {/* Podium */}
      {top3.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[top3[1], top3[0], top3[2]].map((entry: any, i) => {
            if (!entry) return <div key={i} />
            const pnl = entry.total_pnl_bnb ?? 0
            const pos = i === 1 ? 1 : i === 0 ? 2 : 3
            const ranks = ['2nd', '1st', '3rd']
            const colors = ['var(--t2)', 'var(--green)', 'var(--yellow)']
            return (
              <div key={entry.agent_id} className="card" style={{ padding: '20px 16px', textAlign: 'center',
                borderColor: pos === 1 ? 'rgba(185,241,74,0.3)' : 'var(--s3)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: colors[i], marginBottom: 6,
                  fontFamily: 'Space Mono, monospace', letterSpacing: '0.05em' }}>
                  {ranks[i]}
                </div>
                <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 14, marginBottom: 4 }}>
                  {entry.agents?.name ?? '—'}
                </div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 18,
                  color: pnl >= 0 ? 'var(--green)' : '#ff6060' }}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>BNB</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <LiveLeaderboard initialData={leaderboard} />
      </div>
    </div>
  )
}
