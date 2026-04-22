// ============================================================
// SIXTEEN — apps/agent/src/trader-agent.ts
// Trader Agent — reads four.meme event stream, buys early,
// exits at profit target. Kimi K2 decides every trade.
//
// Cycle:
//   1. Fetch last 50 blocks of TokenCreate events
//   2. Screen each new token (version, bonding %, creator tax)
//   3. Kimi K2 decides: buy yes/no and how much
//   4. quoteBuy → buyToken → record position
//   5. Check all open positions: quoteSell → exit if ±target
//   6. On profit exit: sendBnb to owner wallet
// ============================================================

import { kimiChat, TRADER_AGENT_SYSTEM_PROMPT, FOURMEME_TOOLS } from '@sixteen/ai'
import {
  getTokenInfo, quoteBuy, buyToken, quoteSell, sellToken,
  getTaxInfo, sendBnb, getRecentEvents,
  registerAgentIdentity, getAgentIdentityBalance, getProvider,
} from '@sixteen/blockchain'
import {
  recordTrade, recordPnl, updateAgentStatus, getAgentById, upsertLeaderboard,
} from '@sixteen/db'
import {
  logAgentAction, logTradeExecuted, logProfitSent,
} from './logger'
import { recordSuccess, recordFailure } from './monitor'
import { ethers }                        from 'ethers'
import type { ChatCompletionMessageParam } from 'openai/resources'

const MAX_POSITION_BNB   = 0.2
const MAX_OPEN_POSITIONS = 5
const PROFIT_TARGET_PCT  = 30
const STOP_LOSS_PCT      = 15

interface Position {
  tokenAddress:    string
  entryFundsBnb:   number
  tokenAmountWei:  string
  entryTradeId:    string
  entryTimestamp:  number
}

const openPositions = new Map<string, Position>()

// ── Main loop ─────────────────────────────────────────────

export async function runTraderAgent(agentId: string): Promise<void> {
  const agent = await getAgentById(agentId)
  console.log(`[trader:${agent.name}] Starting cycle`)

  await ensureAgentIdentity(agentId, agent.name, agent.wallet_address)
  await updateAgentStatus(agentId, 'running')

  try {
    // 1. Fetch recent events
    const provider     = getProvider()
    const currentBlock = await provider.getBlockNumber()
    const fromBlock    = currentBlock - 50
    const events       = await getRecentEvents(fromBlock, currentBlock)
    const newTokens    = events.filter(e => e.type === 'TokenCreate')
    console.log(`[trader:${agent.name}] ${newTokens.length} new tokens, ${openPositions.size} open positions`)

    // 2. Evaluate new tokens for entry
    for (const event of newTokens) {
      if (openPositions.size >= MAX_OPEN_POSITIONS) break
      if (openPositions.has(event.tokenAddress)) continue
      await evaluateAndMaybeBuy(agentId, agent, event.tokenAddress)
    }

    // 3. Check existing positions for exit
    for (const [tokenAddress, position] of openPositions) {
      await checkAndMaybeExit(agentId, agent, tokenAddress, position)
    }

    // 4. Update leaderboard
    const totalPnl = Array.from(openPositions.values())
      .reduce((sum) => sum, 0)
    await upsertLeaderboard({
      agent_id:        agentId,
      total_pnl_bnb:   totalPnl,
      tokens_created:  0,
      trades_executed: openPositions.size,
    }).catch(() => null)

    recordSuccess(agentId)
    console.log(`[trader:${agent.name}] Cycle complete`)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[trader:${agent.name}] Error:`, msg)
    await recordFailure(agentId, 'trader_cycle', msg)
    await logAgentAction({ agent_id: agentId, action: 'error', reasoning: msg, outcome: 'failed' })
    await updateAgentStatus(agentId, 'error')
    return
  }

  await updateAgentStatus(agentId, 'idle')
}

// ── Evaluate new token for buy ────────────────────────────

async function evaluateAndMaybeBuy(
  agentId: string,
  agent:   Awaited<ReturnType<typeof getAgentById>>,
  tokenAddress: string
): Promise<void> {
  try {
    const [tokenInfo, taxInfo] = await Promise.all([
      getTokenInfo(tokenAddress),
      getTaxInfo(tokenAddress).catch(() => null),
    ])

    // Only trade V2 tokens
    if (tokenInfo.version !== 2) return

    const bondingPct = tokenInfo.maxFunds > 0n
      ? Number((tokenInfo.funds * 100n) / tokenInfo.maxFunds)
      : 0

    // Skip if bonding curve already >40% filled
    if (bondingPct > 40) {
      await logAgentAction({ agent_id: agentId, action: 'skip', token_address: tokenAddress, reasoning: `Bonding ${bondingPct}% too full`, outcome: 'skipped' })
      return
    }

    // Skip if creator tax too high
    if (taxInfo && Number(taxInfo.rateFounder) > 60) {
      await logAgentAction({ agent_id: agentId, action: 'skip', token_address: tokenAddress, reasoning: `Creator tax ${taxInfo.rateFounder}% too high`, outcome: 'skipped' })
      return
    }

    // Ask Kimi K2
    const decision = await kimiDecide('buy', {
      tokenAddress,
      bondingCurvePct:   bondingPct,
      lastPriceWei:      tokenInfo.lastPrice.toString(),
      taxFounderRate:    taxInfo ? Number(taxInfo.rateFounder) : 0,
      openPositionCount: openPositions.size,
    })

    if (!decision.shouldAct) {
      await logAgentAction({ agent_id: agentId, action: 'skip', token_address: tokenAddress, reasoning: decision.reasoning, outcome: 'skipped' })
      return
    }

    // Execute buy
    const fundsBnb = Math.min(decision.amountBnb ?? 0.05, MAX_POSITION_BNB).toString()
    await quoteBuy(tokenAddress, fundsBnb)  // validate first
    const bought = await buyToken(tokenAddress, fundsBnb)

    const trade = await recordTrade({
      agent_id:         agentId,
      token_address:    tokenAddress,
      action:           'buy',
      amount_wei:       ethers.parseEther(fundsBnb).toString(),
      token_amount_wei: bought.tokenAmount.toString(),
      tx_hash:          bought.txHash,
    })

    openPositions.set(tokenAddress, {
      tokenAddress,
      entryFundsBnb:   parseFloat(fundsBnb),
      tokenAmountWei:  bought.tokenAmount.toString(),
      entryTradeId:    trade.id,
      entryTimestamp:  Date.now(),
    })

    await logTradeExecuted(agentId, agent.owner_wallet, 'buy', tokenAddress, parseFloat(fundsBnb), decision.reasoning)
    console.log(`[trader:${agent.name}] Bought ${tokenAddress} for ${fundsBnb} BNB — ${decision.reasoning}`)

  } catch (err) {
    console.warn(`[trader] Buy eval failed for ${tokenAddress}:`, (err as Error).message)
  }
}

// ── Check existing position for exit ─────────────────────

async function checkAndMaybeExit(
  agentId:  string,
  agent:    Awaited<ReturnType<typeof getAgentById>>,
  tokenAddress: string,
  position: Position
): Promise<void> {
  try {
    const quote      = await quoteSell(tokenAddress, position.tokenAmountWei)
    const returnBnb  = parseFloat(ethers.formatEther(quote.fundsReturn))
    const pnlPct     = ((returnBnb - position.entryFundsBnb) / position.entryFundsBnb) * 100

    const shouldExit = pnlPct >= PROFIT_TARGET_PCT || pnlPct <= -STOP_LOSS_PCT
    if (!shouldExit) return

    const reason = pnlPct >= PROFIT_TARGET_PCT ? `Profit target hit (+${pnlPct.toFixed(1)}%)` : `Stop loss triggered (${pnlPct.toFixed(1)}%)`
    console.log(`[trader:${agent.name}] Exiting ${tokenAddress}: ${reason}`)

    // Execute sell
    const sold  = await sellToken(tokenAddress, position.tokenAmountWei)
    const trade = await recordTrade({
      agent_id:         agentId,
      token_address:    tokenAddress,
      action:           'sell',
      amount_wei:       position.tokenAmountWei,
      token_amount_wei: quote.fundsReturn.toString(),
      tx_hash:          sold.txHash,
    })

    const pnlBnb = returnBnb - position.entryFundsBnb
    await recordPnl(trade.id, pnlBnb)

    // Route profit to owner
    if (pnlBnb > 0) {
      const profitWei = ethers.parseEther(pnlBnb.toFixed(8)).toString()
      const txHash    = await sendBnb(agent.owner_wallet, profitWei)
      await logProfitSent(agentId, agent.owner_wallet, pnlBnb, txHash)
      console.log(`[trader:${agent.name}] Profit ${pnlBnb.toFixed(4)} BNB → owner. tx: ${txHash}`)
    }

    await logTradeExecuted(agentId, agent.owner_wallet, 'sell', tokenAddress, returnBnb, reason, pnlBnb)
    openPositions.delete(tokenAddress)

  } catch (err) {
    console.warn(`[trader] Exit check failed for ${tokenAddress}:`, (err as Error).message)
  }
}

// ── Kimi K2: trade decision ───────────────────────────────

interface TradeDecision {
  shouldAct:  boolean
  amountBnb?: number
  reasoning:  string
}

async function kimiDecide(
  action:  'buy' | 'sell',
  context: { tokenAddress: string; bondingCurvePct: number; lastPriceWei: string; taxFounderRate: number; openPositionCount: number }
): Promise<TradeDecision> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: TRADER_AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Token: ${context.tokenAddress}
Action: ${action}
Bonding curve filled: ${context.bondingCurvePct}%
Last price (wei): ${context.lastPriceWei}
Creator tax rate: ${context.taxFounderRate}%
Open positions: ${context.openPositionCount}/${MAX_OPEN_POSITIONS}

Should I ${action}? JSON only: {"shouldAct":true|false,"amountBnb":<number if buy>,"reasoning":"<one sentence>"}`,
    },
  ]

  const response = await kimiChat({ messages, tools: FOURMEME_TOOLS, temperature: 0.5, maxTokens: 200 })

  try {
    const clean = response.content.trim().replace(/```json\n?/g,'').replace(/```\n?/g,'')
    return JSON.parse(clean) as TradeDecision
  } catch {
    return { shouldAct: false, reasoning: 'JSON parse error — skipping' }
  }
}

// ── EIP-8004 identity ─────────────────────────────────────

async function ensureAgentIdentity(agentId: string, name: string, wallet: string): Promise<void> {
  try {
    const balance = await getAgentIdentityBalance(wallet)
    if (balance > 0) return
    const result = await registerAgentIdentity(name, '', `Sixteen trader agent — ${name}`)
    console.log(`[trader] EIP-8004 registered — tokenId: ${result.tokenId}`)
  } catch {
    // non-fatal
  }
}
