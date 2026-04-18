// ============================================================
// SIXTEEN — scripts/simulate-round.ts
// Full competition round simulation on BNB testnet
//
// Simulates a complete Sixteen round:
//   1. Registers 2 agents (creator + trader)
//   2. Starts a competition round
//   3. Creator agent launches 2 meme tokens
//   4. Trader agent buys both tokens
//   5. Waits 60 seconds
//   6. Trader agent sells both positions
//   7. Ends the round + declares winner
//   8. Prints final leaderboard
//
// Run: npx tsx scripts/simulate-round.ts
// ============================================================

import {
  getRunningAgents,
  createRound,
  startRound,
  endRound,
  getLeaderboard,
  upsertLeaderboard,
  db,
} from '@sixteen/db'
import { runCreatorAgent } from '../apps/agent/src/creator-agent'
import { runTraderAgent }  from '../apps/agent/src/trader-agent'
import { runHealthCheck }  from '../apps/agent/src/monitor'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function simulate(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════╗')
  console.log('║   SIXTEEN — Competition Round Simulation    ║')
  console.log('║   BNB Testnet                               ║')
  console.log('╚════════════════════════════════════════════╝\n')

  // ── Step 1: Health check ────────────────────────────────
  console.log('Step 1: Health check')
  const health = await runHealthCheck()
  if (!health.kimiK2 || !health.supabase || !health.bnbRpc) {
    console.error('Health check failed — aborting simulation')
    process.exit(1)
  }
  console.log('  All systems healthy ✓\n')

  // ── Step 2: Get or create test agents ──────────────────
  console.log('Step 2: Setting up test agents')

  // Ensure we have at least one creator and one trader agent set to 'running'
  const { data: existingAgents } = await db()
    .from('agents')
    .select('*')
    .in('type', ['creator', 'trader', 'hybrid'])
    .limit(2)

  if (!existingAgents?.length) {
    console.error('  No agents found in database.')
    console.error('  Create agents first via the dashboard at http://localhost:3000/dashboard')
    console.error('  Then set their status to "running" and re-run this script.')
    process.exit(1)
  }

  const creatorAgent = existingAgents.find((a) => a.type === 'creator' || a.type === 'hybrid')
  const traderAgent  = existingAgents.find((a) => a.type === 'trader'  || a.type === 'hybrid')

  if (!creatorAgent) { console.error('  No creator/hybrid agent found'); process.exit(1) }
  if (!traderAgent)  { console.error('  No trader/hybrid agent found');  process.exit(1) }

  // Set both to running
  await db().from('agents').update({ status: 'running' }).eq('id', creatorAgent.id)
  await db().from('agents').update({ status: 'running' }).eq('id', traderAgent.id)

  console.log(`  Creator: ${creatorAgent.name} (${creatorAgent.id.slice(0, 8)}…)`)
  console.log(`  Trader:  ${traderAgent.name} (${traderAgent.id.slice(0, 8)}…)\n`)

  // ── Step 3: Create + start competition round ───────────
  console.log('Step 3: Starting competition round')
  const round = await createRound(1)  // 1 hour for simulation
  await startRound(round.id)
  console.log(`  Round ${round.id.slice(0, 8)}… started ✓\n`)

  // ── Step 4: Creator agent cycle ────────────────────────
  console.log('Step 4: Running creator agent (may take 2-3 minutes for video generation)')
  try {
    await runCreatorAgent(creatorAgent.id)
    console.log('  Creator cycle complete ✓\n')
  } catch (err) {
    console.warn('  Creator cycle error (continuing):', err)
  }

  // ── Step 5: Trader agent cycle ─────────────────────────
  console.log('Step 5: Running trader agent')
  try {
    await runTraderAgent(traderAgent.id)
    console.log('  Trader cycle complete ✓\n')
  } catch (err) {
    console.warn('  Trader cycle error (continuing):', err)
  }

  // ── Step 6: Wait 30 seconds then second trader cycle ──
  console.log('Step 6: Waiting 30 seconds for bonding curve movement...')
  await sleep(30_000)

  console.log('  Running second trader cycle (exit positions)')
  try {
    await runTraderAgent(traderAgent.id)
    console.log('  Second trader cycle complete ✓\n')
  } catch (err) {
    console.warn('  Second trader cycle error (continuing):', err)
  }

  // ── Step 7: Tally leaderboard ──────────────────────────
  console.log('Step 7: Tallying leaderboard')

  // Get trade P&L for each agent in this simulation
  const { data: trades } = await db()
    .from('agent_trades')
    .select('agent_id, pnl_bnb, action')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // last hour

  const pnlByAgent = new Map<string, number>()
  const tradesByAgent = new Map<string, number>()

  for (const trade of trades ?? []) {
    pnlByAgent.set(trade.agent_id, (pnlByAgent.get(trade.agent_id) ?? 0) + (trade.pnl_bnb ?? 0))
    tradesByAgent.set(trade.agent_id, (tradesByAgent.get(trade.agent_id) ?? 0) + 1)
  }

  for (const [agentId, pnl] of pnlByAgent) {
    await upsertLeaderboard({
      agent_id:       agentId,
      round_id:       round.id,
      total_pnl_bnb:  pnl,
      tokens_created: agentId === creatorAgent.id ? 1 : 0,
      trades_executed: tradesByAgent.get(agentId) ?? 0,
    })
  }

  // ── Step 8: End round + declare winner ─────────────────
  console.log('Step 8: Ending round')
  const leaderboard = await getLeaderboard(round.id)
  const winner = leaderboard[0]
  const winnerId = winner?.agent_id ?? creatorAgent.id

  await endRound(round.id, winnerId)
  console.log(`  Round ended. Winner: ${winner?.agents?.name ?? 'Unknown'} ✓\n`)

  // ── Step 9: Print final leaderboard ───────────────────
  console.log('════════════════════════════════════')
  console.log('FINAL LEADERBOARD')
  console.log('════════════════════════════════════')

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i]
    if (!entry) continue
    const medal = ['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`
    const pnl   = entry.total_pnl_bnb ?? 0
    const pnlStr = `${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} BNB`
    console.log(`  ${medal} ${entry.agents?.name ?? 'Unknown'} — ${pnlStr} P&L  |  ${entry.trades_executed} trades  |  ${entry.tokens_created} tokens`)
  }

  console.log('\n✓ Simulation complete!')
  console.log(`  View results at: http://localhost:3000/arena`)
  console.log(`  Full logs at:    http://localhost:3000/logs\n`)
}

simulate().catch((err) => {
  console.error('Simulation failed:', err)
  process.exit(1)
})
