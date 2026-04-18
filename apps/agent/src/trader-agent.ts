// ============================================================
// SIXTEEN — apps/agent/src/trader-agent.ts
// Trader Agent — reads the event stream, evaluates tokens,
// enters in Insider Phase, exits at profit target
// Powered by Kimi K2 decision making
// ============================================================

import {
  kimiChat,
  TRADER_AGENT_SYSTEM_PROMPT,
  FOURMEME_TOOLS,
} from '@sixteen/ai'
import {
  getTokenInfo,
  quoteBuy,
  buyToken,
  quoteSell,
  sellToken,
  getTaxInfo,
  sendBnb,
  getRecentEvents,
  getAgentWalletAddress,
  registerAgentIdentity,
  getAgentIdentityBalance,
} from '@sixteen/blockchain'
import {
  recordTrade,
  recordPnl,
  updateAgentStatus,
  getAgentById,
  upsertLeaderboard,
} from '@sixteen/db'
import { ethers } from 'ethers'
import type { ChatCompletionMessageParam } from 'openai/resources/chat'

// ── Trading limits ────────────────────────────────────────
const MAX_POSITION_BNB = 0.2       // max 0.2 BNB per token
const MAX_OPEN_POSITIONS = 5       // max 5 simultaneous positions
const PROFIT_TARGET_PCT = 30       // exit at +30% gain
const STOP_LOSS_PCT = 15           // exit at -15% loss
const MIN_VIRALITY_SCORE = 65      // only trade tokens with score >= 65
const MAX_BONDING_CURVE_PCT = 40   // only buy below 40% filled

// ── Open position tracking (in-memory, Supabase persists) ─
interface Position {
  tokenAddress: string
  entryFundsBnb: number
  tokenAmountWei: string
  entryTradeId: string
  entryTimestamp: number
}

const openPositions = new Map<string, Position>()

// ── Trader agent main loop ────────────────────────────────

export async function runTraderAgent(agentId: string): Promise<void> {
  const agent = await getAgentById(agentId)
  console.log(`[trader] Starting agent: ${agent.name} (${agent.wallet_address})`)

  await ensureAgentIdentity(agentId, agent.name, agent.wallet_address)
  await updateAgentStatus(agentId, 'running')

  try {
    // Step 1: Get recent events from four.meme event stream
    const provider = (await import('@sixteen/blockchain')).getProvider()
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = currentBlock - 50  // last ~50 blocks (~2.5 mins on BSC)

    console.log(`[trader] Fetching events from block ${fromBlock}...`)
    const events = await getRecentEvents(fromBlock, currentBlock)

    const newTokens = events.filter((e) => e.type === 'TokenCreate')
    console.log(`[trader] Found ${newTokens.length} new tokens, ${events.length} total events`)

    // Step 2: Evaluate each new token for potential buy
    for (const event of newTokens) {
      if (openPositions.size >= MAX_OPEN_POSITIONS) {
        console.log('[trader] Max positions reached — skipping new tokens')
        break
      }
      if (openPositions.has(event.tokenAddress)) continue

      await evaluateAndMaybeBuy(agentId, event.tokenAddress, agent.owner_wallet)
    }

    // Step 3: Check existing positions for exit signals
    for (const [tokenAddress, position] of openPositions) {
      await checkAndMaybeExit(agentId, tokenAddress, position, agent.owner_wallet)
    }

    // Step 4: Update leaderboard
    const totalPnl = Array.from(openPositions.values()).reduce((sum) => sum, 0)
    await upsertLeaderboard({
      agent_id: agentId,
      total_pnl_bnb: totalPnl,
      tokens_created: 0,
      trades_executed: openPositions.size,
    })

    console.log('[trader] Cycle complete.')
  } catch (err) {
    console.error('[trader] Error:', err)
    await updateAgentStatus(agentId, 'error')
    return
  }

  await updateAgentStatus(agentId, 'idle')
}

// ── Evaluate a token and decide whether to buy ────────────

async function evaluateAndMaybeBuy(
  agentId: string,
  tokenAddress: string,
  ownerWallet: string
): Promise<void> {
  console.log(`[trader] Evaluating token: ${tokenAddress}`)

  try {
    // Get token state
    const [tokenInfo, taxInfo] = await Promise.all([
      getTokenInfo(tokenAddress),
      getTaxInfo(tokenAddress).catch(() => null),
    ])

    // Only trade V2 tokens
    if (tokenInfo.version !== 2) {
      console.log(`[trader] Skipping V1 token: ${tokenAddress}`)
      return
    }

    // Check bonding curve fill %
    const bondingPct = tokenInfo.maxFunds > 0n
      ? Number((tokenInfo.funds * 100n) / tokenInfo.maxFunds)
      : 0
    if (bondingPct > MAX_BONDING_CURVE_PCT) {
      console.log(`[trader] Bonding curve too full (${bondingPct}%) — skipping`)
      return
    }

    // Check tax config — skip if creator takes > 60%
    if (taxInfo && Number(taxInfo.rateFounder) > 60) {
      console.log(`[trader] Creator rate too high (${taxInfo.rateFounder}%) — skipping`)
      return
    }

    // Ask Kimi K2 for buy decision
    const decision = await kimiTradeDecision('buy', {
      tokenAddress,
      bondingCurvePct: bondingPct,
      lastPriceWei: tokenInfo.lastPrice.toString(),
      taxFounderRate: taxInfo ? Number(taxInfo.rateFounder) : 0,
      openPositionCount: openPositions.size,
    })

    if (!decision.shouldAct) {
      console.log(`[trader] Kimi K2 says skip: ${decision.reasoning}`)
      return
    }

    // Get buy quote
    const fundsBnb = Math.min(decision.amountBnb ?? 0.05, MAX_POSITION_BNB).toString()
    const quote = await quoteBuy(tokenAddress, fundsBnb)
    console.log(`[trader] Buy quote: ${ethers.formatEther(quote.tokenAmount)} tokens for ${fundsBnb} BNB`)

    // Execute buy
    const buyResult = await buyToken(tokenAddress, fundsBnb)
    console.log(`[trader] Bought! tx: ${buyResult.txHash}`)

    // Record trade in Supabase
    const trade = await recordTrade({
      agent_id: agentId,
      token_address: tokenAddress,
      action: 'buy',
      amount_wei: ethers.parseEther(fundsBnb).toString(),
      token_amount_wei: buyResult.tokenAmount.toString(),
      tx_hash: buyResult.txHash,
    })

    // Track open position
    openPositions.set(tokenAddress, {
      tokenAddress,
      entryFundsBnb: parseFloat(fundsBnb),
      tokenAmountWei: buyResult.tokenAmount.toString(),
      entryTradeId: trade.id,
      entryTimestamp: Date.now(),
    })

    console.log(`[trader] Position opened: ${tokenAddress} — ${fundsBnb} BNB`)
  } catch (err) {
    console.warn(`[trader] Failed to evaluate ${tokenAddress}:`, err)
  }
}

// ── Check an existing position for exit ───────────────────

async function checkAndMaybeExit(
  agentId: string,
  tokenAddress: string,
  position: Position,
  ownerWallet: string
): Promise<void> {
  try {
    const quote = await quoteSell(tokenAddress, position.tokenAmountWei)
    const returnBnb = parseFloat(ethers.formatEther(quote.fundsReturn))
    const pnlPct = ((returnBnb - position.entryFundsBnb) / position.entryFundsBnb) * 100

    console.log(`[trader] Position ${tokenAddress}: P&L ${pnlPct.toFixed(1)}%`)

    const shouldExit =
      pnlPct >= PROFIT_TARGET_PCT ||
      pnlPct <= -STOP_LOSS_PCT

    if (!shouldExit) return

    const reason = pnlPct >= PROFIT_TARGET_PCT ? 'profit target hit' : 'stop loss triggered'
    console.log(`[trader] Exiting position (${reason}): ${tokenAddress}`)

    // Execute sell
    const sellResult = await sellToken(tokenAddress, position.tokenAmountWei)
    console.log(`[trader] Sold! tx: ${sellResult.txHash}`)

    // Record trade and P&L
    const trade = await recordTrade({
      agent_id: agentId,
      token_address: tokenAddress,
      action: 'sell',
      amount_wei: position.tokenAmountWei,
      token_amount_wei: quote.fundsReturn.toString(),
      tx_hash: sellResult.txHash,
    })

    const pnlBnb = returnBnb - position.entryFundsBnb
    await recordPnl(trade.id, pnlBnb)

    // Route profit to owner wallet if positive
    if (pnlBnb > 0) {
      const profitWei = ethers.parseEther(pnlBnb.toFixed(8)).toString()
      const txHash = await sendBnb(ownerWallet, profitWei)
      console.log(`[trader] Profit ${pnlBnb.toFixed(4)} BNB sent to owner. tx: ${txHash}`)
    }

    openPositions.delete(tokenAddress)
  } catch (err) {
    console.warn(`[trader] Exit check failed for ${tokenAddress}:`, err)
  }
}

// ── Kimi K2: trade decision ───────────────────────────────

interface TradeContext {
  tokenAddress: string
  bondingCurvePct: number
  lastPriceWei: string
  taxFounderRate: number
  openPositionCount: number
}

interface TradeDecision {
  shouldAct: boolean
  amountBnb?: number
  reasoning: string
}

async function kimiTradeDecision(
  action: 'buy' | 'sell',
  context: TradeContext
): Promise<TradeDecision> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: TRADER_AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `
Token: ${context.tokenAddress}
Action to evaluate: ${action}
Bonding curve filled: ${context.bondingCurvePct}%
Last price (wei): ${context.lastPriceWei}
Creator tax rate: ${context.taxFounderRate}%
Open positions: ${context.openPositionCount}/${MAX_OPEN_POSITIONS}

Should I ${action} this token? Respond ONLY with JSON:
{"shouldAct":true|false,"amountBnb":<number if buy>,"reasoning":"<one sentence>"}
      `.trim(),
    },
  ]

  const response = await kimiChat({
    messages,
    tools: FOURMEME_TOOLS,
    temperature: 0.6,
    maxTokens: 256,
  })

  try {
    return JSON.parse(response.content.trim()) as TradeDecision
  } catch {
    return { shouldAct: false, reasoning: 'Parse error — defaulting to no action' }
  }
}

// ── EIP-8004 registration ─────────────────────────────────

async function ensureAgentIdentity(
  agentId: string,
  agentName: string,
  walletAddress: string
): Promise<void> {
  try {
    const balance = await getAgentIdentityBalance(walletAddress)
    if (balance > 0) return
    console.log('[trader] Registering EIP-8004 identity...')
    const result = await registerAgentIdentity(agentName, '', `Sixteen trader agent — ${agentName}`)
    console.log(`[trader] EIP-8004 registered — tokenId: ${result.tokenId}`)
  } catch (err) {
    console.warn('[trader] EIP-8004 registration failed (non-fatal):', err)
  }
}
