// ============================================================
// SIXTEEN — apps/agent/src/index.ts
// Agent runner — orchestrates all registered agents
// Runs on a cron every 2-3 minutes (BSC block time ~3s,
// so 2 min gives ~40 new blocks to check per cycle)
// ============================================================

import cron from 'node-cron'
import { getRunningAgents, getAgentById, updateAgentStatus } from '@sixteen/db'
import { runCreatorAgent } from './creator-agent'
import { runTraderAgent } from './trader-agent'

const AGENT_CYCLE_CRON = '*/2 * * * *'  // every 2 minutes

async function runAgentCycle(): Promise<void> {
  console.log(`\n[runner] ─── Agent cycle started: ${new Date().toISOString()} ───`)

  let agents: Awaited<ReturnType<typeof getRunningAgents>> = []
  try {
    agents = await getRunningAgents()
  } catch (err) {
    console.error('[runner] Failed to fetch agents from Supabase:', err)
    return
  }

  if (!agents.length) {
    console.log('[runner] No running agents — waiting for next cycle')
    return
  }

  console.log(`[runner] Found ${agents.length} running agent(s)`)

  // Run all agents concurrently
  await Promise.allSettled(
    agents.map(async (agent) => {
      console.log(`[runner] → Running agent: ${agent.name} (${agent.type})`)
      try {
        if (agent.type === 'creator') {
          await runCreatorAgent(agent.id)
        } else if (agent.type === 'trader') {
          await runTraderAgent(agent.id)
        } else if (agent.type === 'hybrid') {
          // Hybrid: alternate between creation and trading each cycle
          const cycleMinute = new Date().getMinutes()
          if (cycleMinute % 4 === 0) {
            await runCreatorAgent(agent.id)
          } else {
            await runTraderAgent(agent.id)
          }
        }
      } catch (err) {
        console.error(`[runner] Agent ${agent.name} crashed:`, err)
        await updateAgentStatus(agent.id, 'error').catch(() => null)
      }
    })
  )

  console.log(`[runner] ─── Cycle complete ───\n`)
}

// ── Bootstrap ─────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════╗')
  console.log('║     SIXTEEN Agent Runner v0.1        ║')
  console.log('║     BNB Testnet                      ║')
  console.log('╚══════════════════════════════════════╝')
  console.log(`Kimi K2 model: moonshotai/Kimi-K2-Instruct-0905`)
  console.log(`HF Endpoint:   https://router.huggingface.co/v1`)
  console.log(`Cron schedule: ${AGENT_CYCLE_CRON} (every 2 mins)`)
  console.log('')

  // Verify env vars
  const required = [
    'HF_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'AGENT_PRIVATE_KEY',
    'BSC_TESTNET_RPC_URL',
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`[runner] Missing required env vars: ${missing.join(', ')}`)
    process.exit(1)
  }

  console.log('[runner] All required env vars present ✓')

  // Run once immediately on startup
  await runAgentCycle()

  // Then schedule cron
  cron.schedule(AGENT_CYCLE_CRON, runAgentCycle)
  console.log(`[runner] Cron started — next run in 2 minutes`)
}

main().catch((err) => {
  console.error('[runner] Fatal error:', err)
  process.exit(1)
})
