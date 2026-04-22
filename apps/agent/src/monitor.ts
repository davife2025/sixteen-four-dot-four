// ============================================================
// SIXTEEN — apps/agent/src/monitor.ts
// ============================================================

import { db, updateAgentStatus } from '@sixteen/db'

interface AgentError {
  agent_id:   string
  error_type: string
  message:    string
  context?:   Record<string, unknown>
}

export async function logAgentError(err: AgentError): Promise<void> {
  try {
    await db()
      .from('agent_errors')
      .insert({
        agent_id:   err.agent_id,
        error_type: err.error_type,
        message:    err.message,
        // exactOptionalPropertyTypes fix: spread conditionally
        ...(err.context !== undefined ? { context: err.context } : { context: {} }),
        created_at: new Date().toISOString(),
      })
  } catch {
    console.error('[monitor] Failed to log error to Supabase:', err.message)
  }
}

const failureCounts          = new Map<string, number>()
const MAX_CONSECUTIVE_FAILURES = 5

export function recordSuccess(agentId: string): void {
  failureCounts.set(agentId, 0)
}

export async function recordFailure(
  agentId:   string,
  errorType: string,
  message:   string,
  context?:  Record<string, unknown>
): Promise<void> {
  const count = (failureCounts.get(agentId) ?? 0) + 1
  failureCounts.set(agentId, count)

  // exactOptionalPropertyTypes fix: only pass context if defined
  await logAgentError({
    agent_id:   agentId,
    error_type: errorType,
    message,
    ...(context !== undefined && { context }),
  })

  if (count >= MAX_CONSECUTIVE_FAILURES) {
    console.error(`[monitor] Agent ${agentId} has failed ${count} times consecutively — pausing`)
    await updateAgentStatus(agentId, 'error')
    failureCounts.set(agentId, 0)
  }


export async function runHealthCheck(): Promise<{
  kimiK2:   boolean
  supabase: boolean
  bnbRpc:   boolean
}> {
  const results = { kimiK2: false, supabase: false, bnbRpc: false }

  try {
    const { getKimiClient, KIMI_MODEL } = await import('@sixteen/ai')
    const client = getKimiClient()
    await client.chat.completions.create({
      model:      KIMI_MODEL,
      messages:   [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    })
    results.kimiK2 = true
  } catch (err) {
    console.error('[monitor] Kimi K2 health check failed:', err)
  }

  try {
    const { db } = await import('@sixteen/db')
    await db().from('agents').select('id').limit(1)
    results.supabase = true
  } catch (err) {
    console.error('[monitor] Supabase health check failed:', err)
  }

  try {
    const { getProvider } = await import('@sixteen/blockchain')
    await getProvider().getBlockNumber()
    results.bnbRpc = true
  } catch (err) {
    console.error('[monitor] BNB RPC health check failed:', err)
  }

  console.log(`[monitor] Health: Kimi K2=${results.kimiK2} Supabase=${results.supabase} BNB=${results.bnbRpc}`)
  return results
}



}