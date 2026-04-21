// ============================================================
// SIXTEEN — apps/agent/src/index.ts
// Agent runner — bootstraps and orchestrates all agents
//
// Architecture:
//   - Main cron: every 2 minutes — runs all active agents
//   - Bonding sync: every 30 seconds — updates bonding curve %
//   - Health check: on startup — validates all env vars + RPC
//
// Agent types:
//   creator → runCreatorAgent (trends → concept → launch)
//   trader  → runTraderAgent  (events → screen → buy/sell)
//   hybrid  → runHybridAgent  (alternates creation + trading)
// ============================================================

import cron                       from 'node-cron'
import { getRunningAgents, updateAgentStatus } from '@sixteen/db'
import { getProvider }            from '@sixteen/blockchain'
import { runCreatorAgent }        from './creator-agent'
import { runTraderAgent }         from './trader-agent'
import { runHybridAgent }         from './hybrid-agent'
import { startBondingSync }       from './bonding-sync'

const AGENT_CRON = '*/2 * * * *'   // every 2 minutes

// ── Agent cycle ───────────────────────────────────────────

async function runAgentCycle(): Promise<void> {
  const ts = new Date().toISOString()
  console.log(`\n[runner] ─── Cycle: ${ts} ───`)

  let agents: Awaited<ReturnType<typeof getRunningAgents>>
  try {
    agents = await getRunningAgents()
  } catch (err) {
    console.error('[runner] Failed to fetch agents from Supabase:', err)
    return
  }

  if (!agents.length) {
    console.log('[runner] No running agents — waiting')
    return
  }

  console.log(`[runner] ${agents.length} running agent(s)`)

  await Promise.allSettled(
    agents.map(async agent => {
      console.log(`[runner] → ${agent.name} (${agent.type})`)
      try {
        switch (agent.type) {
          case 'creator': await runCreatorAgent(agent.id); break
          case 'trader':  await runTraderAgent(agent.id);  break
          case 'hybrid':  await runHybridAgent(agent.id);  break
          default:
            console.warn(`[runner] Unknown agent type: ${agent.type}`)
        }
      } catch (err) {
        console.error(`[runner] Agent ${agent.name} crashed:`, err)
        await updateAgentStatus(agent.id, 'error').catch(() => null)
      }
    })
  )

  console.log(`[runner] ─── Cycle complete ───\n`)
}

// ── Health check ──────────────────────────────────────────

async function healthCheck(): Promise<void> {
  const required = [
    'HF_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'AGENT_PRIVATE_KEY',
    'BSC_TESTNET_RPC_URL',
  ]

  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    console.error(`[runner] ✗ Missing env vars: ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log('[runner] ✓ All env vars present')

  // Verify BNB RPC connection
  try {
    const provider    = getProvider()
    const blockNumber = await provider.getBlockNumber()
    console.log(`[runner] ✓ BNB Testnet connected — block #${blockNumber}`)
  } catch (err) {
    console.error('[runner] ✗ BNB RPC connection failed:', err)
    console.error('[runner] Check BSC_TESTNET_RPC_URL and network connectivity')
    process.exit(1)
  }

  // Verify Supabase
  try {
    const { getRunningAgents } = await import('@sixteen/db')
    await getRunningAgents()
    console.log('[runner] ✓ Supabase connected')
  } catch (err) {
    console.error('[runner] ✗ Supabase connection failed:', err)
    process.exit(1)
  }

  console.log('[runner] ✓ Health checks passed\n')
}

// ── Bootstrap ─────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════╗')
  console.log('║   SIXTEEN Agent Runner                     ║')
  console.log('║   Kimi K2 × four.meme × BNB Testnet       ║')
  console.log('╚════════════════════════════════════════════╝')
  console.log(`Model:    moonshotai/Kimi-K2-Instruct-0905`)
  console.log(`Endpoint: https://router.huggingface.co/v1`)
  console.log(`Cron:     ${AGENT_CRON} (every 2 minutes)`)
  console.log('')

  await healthCheck()

  // Start bonding curve sync (every 30 seconds, independent of agent cron)
  startBondingSync()
  console.log('[runner] ✓ Bonding curve sync started (30s interval)')

  // Run one cycle immediately on startup
  await runAgentCycle()

  // Schedule recurring cycles
  cron.schedule(AGENT_CRON, runAgentCycle)
  console.log(`[runner] ✓ Agent cron scheduled — next run in 2 minutes`)
}

main().catch(err => {
  console.error('[runner] Fatal error:', err)
  process.exit(1)
})
