import { createServerClient } from '@/lib/supabase'
import { ArenaLive } from '@/components/arena/ArenaLive'

export const revalidate = 0
export const metadata = { title: 'Arena | Sixteen' }

async function getData() {
  const db = createServerClient()
  const [roundRes, agentsRes, lbRes, tradesRes, logsRes] = await Promise.all([
    db.from('competition_rounds')
      .select('*')
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1),
    db.from('agents')
      .select('id, name, type, status')
      .order('created_at', { ascending: false }),
    db.from('leaderboard')
      .select('*, agents(name, type)')
      .order('total_pnl_bnb', { ascending: false })
      .limit(10),
    db.from('agent_trades')
      .select('id, action, amount_wei, pnl_bnb, created_at, agents(name, type)')
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('agent_logs')
      .select('id, action, reasoning, outcome, created_at, agents(name, type)')
      .order('created_at', { ascending: false })
      .limit(30),
  ])
  return {
    round:     roundRes.data?.[0]  ?? null,
    agents:    agentsRes.data      ?? [],
    leaderboard: lbRes.data        ?? [],
    trades:    tradesRes.data      ?? [],
    logs:      logsRes.data        ?? [],
  }
}

export default async function ArenaPage() {
  const data = await getData()
  return <ArenaLive {...data} />
}
