// ============================================================
// SIXTEEN — apps/agent/src/bonding-sync.ts
// Bonding curve sync — keeps DB accurate without requiring refresh
//
// Every 30 seconds:
//   1. Fetch all non-graduated tokens from Supabase
//   2. Call four.meme token-info for each (getTokenInfo skill)
//   3. Update bonding_curve_pct and phase in Supabase
//
// Does NOT require BITQUERY_API_KEY — uses the four.meme API
// directly via the same skill the agent uses for trading.
// ============================================================

import { getTokenInfo } from '@sixteen/blockchain'
import { db, updateTokenPhase } from '@sixteen/db'

const SYNC_INTERVAL_MS = 30_000   // 30 seconds
const BATCH_SIZE       = 10       // tokens per batch to avoid rate limits

// ── Phase determination ───────────────────────────────────

function determinePhase(bondingPct: number): 'insider' | 'public' | 'graduated' {
  if (bondingPct >= 100) return 'graduated'
  if (bondingPct >= 5)   return 'public'
  return 'insider'
}

// ── Sync one token ────────────────────────────────────────

async function syncToken(tokenAddress: string): Promise<void> {
  try {
    const info = await getTokenInfo(tokenAddress)

    const bondingPct = info.maxFunds > 0n
      ? Math.min(100, Number((info.funds * 10000n) / info.maxFunds) / 100)
      : 0

    const phase = determinePhase(bondingPct)

    await updateTokenPhase(tokenAddress, phase, bondingPct)

    // Log graduations
    if (phase === 'graduated') {
      console.log(`[bonding-sync] 🎓 ${tokenAddress.slice(0,10)}… graduated to PancakeSwap!`)
    }
  } catch {
    // Non-fatal — token may be too new or removed
  }
}

// ── Main sync loop ────────────────────────────────────────

async function syncAll(): Promise<void> {
  try {
    // Get all active (non-graduated) tokens
    const { data: tokens, error } = await db()
      .from('meme_tokens')
      .select('token_address')
      .neq('phase', 'graduated')
      .neq('token_address', '')
      .order('updated_at', { ascending: true })  // sync oldest-updated first
      .limit(50)

    if (error || !tokens?.length) return

    // Process in batches
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(batch.map(t => syncToken(t.token_address)))
      // Small delay between batches to avoid hitting rate limits
      if (i + BATCH_SIZE < tokens.length) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    console.log(`[bonding-sync] Synced ${tokens.length} tokens`)
  } catch (err) {
    console.warn('[bonding-sync] Sync failed:', (err as Error).message)
  }
}

// ── Start the sync background job ────────────────────────

export function startBondingSync(): void {
  // Run once immediately
  void syncAll()
  // Then on interval
  setInterval(() => { void syncAll() }, SYNC_INTERVAL_MS)
}
