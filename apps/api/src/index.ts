// ============================================================
// SIXTEEN — apps/api/src/index.ts
// Competition Round Manager
// Runs independently from the agent engine.
// Responsibilities:
//   - Auto-start pending rounds
//   - Auto-end rounds after duration expires
//   - Tally leaderboard rankings at round end
//   - Declare winner and distribute prizes
// ============================================================

import cron from 'node-cron'
import {
  getActiveRound,
  createRound,
  startRound,
  endRound,
  getLeaderboard,
  upsertLeaderboard,
  db,
} from '@sixteen/db'

// Run round checks every 5 minutes
const ROUND_CHECK_CRON = '*/5 * * * *'

// ── Round lifecycle manager ───────────────────────────────

async function checkRoundLifecycle(): Promise<void> {
  console.log(`[rounds] Checking round lifecycle: ${new Date().toISOString()}`)

  // 1. Get current active round
  const activeRound = await getActiveRound()

  if (activeRound) {
    // Check if round duration has expired
    const startedAt  = new Date(activeRound.started_at ?? Date.now()).getTime()
    const durationMs = activeRound.duration_hours * 60 * 60 * 1000
    const elapsedMs  = Date.now() - startedAt

    if (elapsedMs >= durationMs) {
      console.log(`[rounds] Round ${activeRound.id} has expired — ending now`)
      await finaliseRound(activeRound.id)
    } else {
      const remainingMins = Math.round((durationMs - elapsedMs) / 60000)
      console.log(`[rounds] Active round has ${remainingMins} minutes remaining`)
      // Update live leaderboard rankings mid-round
      await updateLeaderboardRankings(activeRound.id)
    }
    return
  }

  // 2. No active round — check for pending round to start
  const { data: pending } = await db()
    .from('competition_rounds')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (pending) {
    console.log(`[rounds] Starting pending round: ${pending.id}`)
    await startRound(pending.id)
    return
  }

  // 3. No pending rounds — auto-create the next one
  console.log('[rounds] No pending round — creating new 24h round')
  const newRound = await createRound(24)
  await startRound(newRound.id)
  console.log(`[rounds] New round started: ${newRound.id}`)
}

// ── Finalise a round — tally scores, declare winner ───────

async function finaliseRound(roundId: string): Promise<void> {
  console.log(`[rounds] Finalising round ${roundId}...`)

  // Get all agent trades in this round
  const { data: trades } = await db()
    .from('agent_trades')
    .select('agent_id, action, pnl_bnb, token_address')
    .eq('round_id', roundId)

  if (!trades || !trades.length) {
    console.log('[rounds] No trades in this round')
    await endRound(roundId, '')
    return
  }

  // Aggregate P&L per agent
  const agentStats = new Map<string, {
    totalPnl: number
    tokensCreated: number
    tradesExecuted: number
  }>()

  for (const trade of trades) {
    const existing = agentStats.get(trade.agent_id) ?? {
      totalPnl: 0, tokensCreated: 0, tradesExecuted: 0,
    }
    existing.totalPnl += trade.pnl_bnb ?? 0
    existing.tradesExecuted += 1
    agentStats.set(trade.agent_id, existing)
  }

  // Count tokens created per agent
  const { data: tokens } = await db()
    .from('meme_tokens')
    .select('creator_agent_id')

  for (const token of tokens ?? []) {
    if (!token.creator_agent_id) continue
    const existing = agentStats.get(token.creator_agent_id)
    if (existing) {
      existing.tokensCreated += 1
      agentStats.set(token.creator_agent_id, existing)
    }
  }

  // Upsert leaderboard with round_id
  let winner = { agentId: '', pnl: -Infinity }
  for (const [agentId, stats] of agentStats) {
    await upsertLeaderboard({
      agent_id: agentId,
      round_id: roundId,
      total_pnl_bnb: stats.totalPnl,
      tokens_created: stats.tokensCreated,
      trades_executed: stats.tradesExecuted,
    })
    if (stats.totalPnl > winner.pnl) {
      winner = { agentId, pnl: stats.totalPnl }
    }
  }

  // Update ranks
  await updateLeaderboardRankings(roundId)

  // End the round with winner
  await endRound(roundId, winner.agentId)
  console.log(`[rounds] ✓ Round ended. Winner: ${winner.agentId} with ${winner.pnl.toFixed(4)} BNB`)
}

// ── Update leaderboard rankings in order ─────────────────

async function updateLeaderboardRankings(roundId: string): Promise<void> {
  const entries = await getLeaderboard(roundId)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (!entry) continue
    await db()
      .from('leaderboard')
      .update({ rank: i + 1, updated_at: new Date().toISOString() })
      .eq('agent_id', entry.agent_id)
      .eq('round_id', roundId)
  }
}

// ── Bootstrap ─────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   SIXTEEN Competition Round Manager  ║')
  console.log('╚══════════════════════════════════════╝')

  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing  = required.filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`[rounds] Missing env vars: ${missing.join(', ')}`)
    process.exit(1)
  }

  await checkRoundLifecycle()
  cron.schedule(ROUND_CHECK_CRON, checkRoundLifecycle)
  console.log(`[rounds] Cron started — checking every 5 minutes`)
}

main().catch((err) => {
  console.error('[rounds] Fatal:', err)
  process.exit(1)
})
