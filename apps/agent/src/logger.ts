// ============================================================
// SIXTEEN — apps/agent/src/logger.ts
// Agent decision logger — records every action Kimi K2
// takes into Supabase agent_logs for full transparency.
// Also sends owner notifications for key events.
// ============================================================

import { db } from '@sixteen/db'

type ActionType = 'create' | 'buy' | 'sell' | 'skip' | 'error' | 'register' | 'claim'
type Outcome    = 'success' | 'failed' | 'skipped'

export interface LogEntry {
  agent_id:      string
  action:        ActionType
  token_address?: string
  reasoning?:    string
  virality_score?: number
  amount_bnb?:   number
  outcome:       Outcome
}

export async function logAgentAction(entry: LogEntry): Promise<void> {
  try {
    await db()
      .from('agent_logs')
      .insert({
        agent_id:       entry.agent_id,
        action:         entry.action,
        token_address:  entry.token_address ?? null,
        reasoning:      entry.reasoning ?? null,
        virality_score: entry.virality_score ?? null,
        amount_bnb:     entry.amount_bnb ?? null,
        outcome:        entry.outcome,
        created_at:     new Date().toISOString(),
      })
  } catch (err) {
    console.warn('[logger] Failed to write log:', err)
  }
}

// ── Owner notifications ───────────────────────────────────

type NotificationType =
  | 'token_launched'
  | 'trade_executed'
  | 'profit_sent'
  | 'round_won'
  | 'agent_error'

export async function notifyOwner(
  ownerWallet: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db()
      .from('notifications')
      .insert({
        owner_wallet: ownerWallet,
        type,
        title,
        body,
        metadata,
        created_at: new Date().toISOString(),
      })
  } catch (err) {
    console.warn('[logger] Failed to send notification:', err)
  }
}

// ── Convenience helpers ───────────────────────────────────

export async function logTokenLaunched(
  agentId: string,
  ownerWallet: string,
  tokenAddress: string,
  tokenName: string,
  viralityScore: number,
  preSaleBnb: number
): Promise<void> {
  await logAgentAction({
    agent_id:       agentId,
    action:         'create',
    token_address:  tokenAddress,
    reasoning:      `Launched ${tokenName} with virality score ${viralityScore}`,
    virality_score: viralityScore,
    amount_bnb:     preSaleBnb,
    outcome:        'success',
  })
  await notifyOwner(
    ownerWallet,
    'token_launched',
    `🚀 ${tokenName} launched!`,
    `Your agent launched ${tokenName} with a virality score of ${viralityScore}/100. Pre-sale: ${preSaleBnb} BNB.`,
    { token_address: tokenAddress, virality_score: viralityScore }
  )
}

export async function logTradeExecuted(
  agentId: string,
  ownerWallet: string,
  action: 'buy' | 'sell',
  tokenAddress: string,
  amountBnb: number,
  reasoning: string,
  pnlBnb?: number
): Promise<void> {
  await logAgentAction({
    agent_id:      agentId,
    action,
    token_address: tokenAddress,
    reasoning,
    amount_bnb:    amountBnb,
    outcome:       'success',
  })

  if (action === 'sell' && pnlBnb !== undefined) {
    const pnlSign  = pnlBnb >= 0 ? '+' : ''
    const pnlLabel = `${pnlSign}${pnlBnb.toFixed(4)} BNB`
    await notifyOwner(
      ownerWallet,
      'trade_executed',
      `💰 Trade closed: ${pnlLabel}`,
      `Your agent sold tokens at ${tokenAddress.slice(0, 10)}… P&L: ${pnlLabel}`,
      { token_address: tokenAddress, pnl_bnb: pnlBnb }
    )
  }
}

export async function logProfitSent(
  agentId: string,
  ownerWallet: string,
  amountBnb: number,
  txHash: string
): Promise<void> {
  await logAgentAction({
    agent_id:   agentId,
    action:     'claim',
    reasoning:  `Profit of ${amountBnb.toFixed(4)} BNB sent to owner`,
    amount_bnb: amountBnb,
    outcome:    'success',
  })
  await notifyOwner(
    ownerWallet,
    'profit_sent',
    `💸 ${amountBnb.toFixed(4)} BNB sent to your wallet`,
    `Your agent sent ${amountBnb.toFixed(4)} BNB in profits to your wallet. Tx: ${txHash.slice(0, 10)}…`,
    { tx_hash: txHash, amount_bnb: amountBnb }
  )
}

export async function logRoundWon(
  ownerWallet: string,
  agentName: string,
  roundId: string,
  pnlBnb: number
): Promise<void> {
  await notifyOwner(
    ownerWallet,
    'round_won',
    `🏆 ${agentName} won the competition round!`,
    `Your agent topped the leaderboard with ${pnlBnb.toFixed(4)} BNB profit. Prize pool will be distributed on-chain.`,
    { round_id: roundId, pnl_bnb: pnlBnb }
  )
}
