// ============================================================
// SIXTEEN — apps/agent/src/hybrid-agent.ts
// Hybrid Agent — final complete version
// Integrates: Kimi K2 decisions + all 12 four.meme skills
// + safety guards + bonding sync + copy-agent + logging
//
// This is the definitive agent implementation that
// combines creator and trader logic in a single loop
// with full transparency and safety controls.
// ============================================================

import {
  kimiChat,
  HYBRID_AGENT_SYSTEM_PROMPT,
  FOURMEME_TOOLS,
} from '@sixteen/ai'
import {
  createMemeToken,
  uploadMemeImage,
  getTokenInfo,
  quoteBuy,
  buyToken,
  quoteSell,
  sellToken,
  sendBnb,
  getTaxInfo,
  getRecentEvents,
  registerAgentIdentity,
  getAgentIdentityBalance,
  getAgentWalletAddress,
  getPlatformConfig,
} from '@sixteen/blockchain'
import {
  insertMemeToken,
  recordTrade,
  recordPnl,
  updateAgentStatus,
  getAgentById,
  upsertLeaderboard,
} from '@sixteen/db'
import {
  runBuyGuards,
  runCreateGuards,
  resetCycleSpend,
} from './safety'
import {
  logTokenLaunched,
  logTradeExecuted,
  logProfitSent,
  logAgentAction,
} from './logger'
import {
  recordSuccess,
  recordFailure,
} from './monitor'
import {
  mirrorBuyToFollowers,
  mirrorSellToFollowers,
} from './copy-agent'
import { getTopTrends, formatTrendsForKimi } from './trends'
import { scoreMemeVirality } from './virality'
import { getBestStaticMeme, uploadMemeToFourMeme, generateVideoMeme, downloadImageAsBuffer } from './memegen'
import { ethers } from 'ethers'
import type { ChatCompletionMessageParam } from 'openai/resources/chat'

const VIRALITY_THRESHOLD = 60
const MAX_POSITION_BNB   = 0.2
const PROFIT_TARGET_PCT  = 30
const STOP_LOSS_PCT      = 15

// In-memory position tracker
const positions = new Map<string, {
  entryFundsBnb:   number
  tokenAmountWei:  string
  entryTradeId:    string
  entryTimestamp:  number
}>()

// ── Main hybrid agent loop ────────────────────────────────

export async function runHybridAgent(agentId: string): Promise<void> {
  const agent = await getAgentById(agentId)
  console.log(`\n[hybrid:${agent.name}] Starting cycle`)

  resetCycleSpend(agentId)

  // Ensure EIP-8004 identity (Insider Phase access)
  await ensureIdentity(agentId, agent.name, agent.wallet_address)

  // Decide mode: create or trade this cycle
  const minute  = new Date().getMinutes()
  const doCreate = minute % 4 === 0   // create every 4th cycle (~8 mins)

  try {
    if (doCreate) {
      await creationPhase(agentId, agent)
    } else {
      await tradingPhase(agentId, agent)
    }
    recordSuccess(agentId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await recordFailure(agentId, 'cycle_error', msg)
    await logAgentAction({ agent_id: agentId, action: 'error', reasoning: msg, outcome: 'failed' })
  }
}

// ── Creation phase ────────────────────────────────────────

async function creationPhase(agentId: string, agent: Awaited<ReturnType<typeof getAgentById>>) {
  console.log(`[hybrid:${agent.name}] Creation phase`)

  // Get trends
  const trends      = await getTopTrends(5)
  const trendCtx    = formatTrendsForKimi(trends)

  // Ask Kimi K2 for meme concept
  const concept     = await ideateWithKimi(trendCtx, agent.name)

  // Score virality
  const virality    = await scoreMemeVirality(concept.description, trendCtx, concept.tokenName)
  console.log(`[hybrid:${agent.name}] Virality: ${virality.score} — ${virality.recommendation}`)

  if (virality.score < VIRALITY_THRESHOLD) {
    await logAgentAction({
      agent_id:       agentId,
      action:         'skip',
      reasoning:      `Virality ${virality.score} below threshold ${VIRALITY_THRESHOLD}`,
      virality_score: virality.score,
      outcome:        'skipped',
    })
    return
  }

  // Run safety guards
  await runCreateGuards(agentId, {
    name:          concept.tokenName,
    symbol:        concept.symbol,
    description:   concept.description,
    imageUrl:      'https://static.four.meme/placeholder.png',  // validated after upload
    burnRate:      10,
    divideRate:    40,
    liquidityRate: 10,
    recipientRate: 40,
    preSaleBnb:    0.01,
  })

  // Generate meme asset
  let fourMemeImageUrl: string
  let videoUrl: string | undefined

  if (concept.assetType === 'video') {
    console.log(`[hybrid:${agent.name}] Generating video via Kling 2.6…`)
    const video = await generateVideoMeme(concept.description)
    videoUrl    = video.videoUrl
    const thumbBuf = await downloadImageAsBuffer(video.thumbnailUrl)
    fourMemeImageUrl = await uploadMemeImage(thumbBuf, 'image/jpeg')
  } else {
    const meme       = await getBestStaticMeme(concept.description)
    fourMemeImageUrl = await uploadMemeToFourMeme(meme.imageUrl)
  }

  // Launch token
  const result = await createMemeToken({
    name:             concept.tokenName,
    shortName:        concept.symbol,
    description:      concept.description,
    imageUrl:         fourMemeImageUrl,
    label:            concept.label,
    preSaleBnb:       '0.01',
    feeRate:          5,
    burnRate:         10,
    divideRate:       40,
    liquidityRate:    10,
    recipientRate:    40,
    recipientAddress: agent.owner_wallet,
    feePlan:          true,
  })

  console.log(`[hybrid:${agent.name}] Token launched: ${result.tokenAddress}`)

  // Record in Supabase
  await insertMemeToken({
    token_address:   result.tokenAddress,
    name:            concept.tokenName,
    symbol:          concept.symbol,
    description:     concept.description,
    image_url:       fourMemeImageUrl,
    video_url:       videoUrl,
    asset_type:      concept.assetType,
    label:           concept.label,
    creator_agent_id: agentId,
    creator_wallet:  agent.wallet_address,
    tax_fee_rate:    5,
    burn_rate:       10,
    divide_rate:     40,
    liquidity_rate:  10,
    recipient_rate:  40,
    virality_score:  virality.score,
    create_tx_hash:  result.txHash,
  })

  await logTokenLaunched(agentId, agent.owner_wallet, result.tokenAddress, concept.tokenName, virality.score, 0.01)
}

// ── Trading phase ─────────────────────────────────────────

async function tradingPhase(agentId: string, agent: Awaited<ReturnType<typeof getAgentById>>) {
  console.log(`[hybrid:${agent.name}] Trading phase`)

  const provider    = (await import('@sixteen/blockchain')).getProvider()
  const currentBlock = await provider.getBlockNumber()
  const events       = await getRecentEvents(currentBlock - 50, currentBlock)
  const newTokens    = events.filter((e) => e.type === 'TokenCreate')

  // Evaluate new tokens for entry
  for (const event of newTokens.slice(0, 3)) {
    if (positions.size >= 5) break
    if (positions.has(event.tokenAddress)) continue
    await evaluateBuy(agentId, agent, event.tokenAddress)
  }

  // Check existing positions for exit
  for (const [tokenAddress, pos] of positions) {
    await evaluateSell(agentId, agent, tokenAddress, pos)
  }
}

// ── Buy evaluation ────────────────────────────────────────

async function evaluateBuy(agentId: string, agent: Awaited<ReturnType<typeof getAgentById>>, tokenAddress: string) {
  try {
    const [info, tax] = await Promise.all([
      getTokenInfo(tokenAddress),
      getTaxInfo(tokenAddress).catch(() => null),
    ])

    if (info.version !== 2) return

    const bondingPct = info.maxFunds > 0n
      ? Number((info.funds * 100n) / info.maxFunds)
      : 0

    if (bondingPct > 40) return
    if (tax && Number(tax.rateFounder) > 60) return

    // Ask Kimi K2
    const msgs: ChatCompletionMessageParam[] = [
      { role: 'system', content: HYBRID_AGENT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Should I BUY ${tokenAddress}? Bonding: ${bondingPct}%, creator tax: ${tax ? Number(tax.rateFounder) : 0}%, open positions: ${positions.size}/5. Respond JSON: {"shouldBuy":bool,"amountBnb":number,"reasoning":"string"}`
      }
    ]

    const resp     = await kimiChat({ messages: msgs, tools: FOURMEME_TOOLS, temperature: 0.6 })
    const decision = JSON.parse(resp.content.trim()) as { shouldBuy: boolean; amountBnb: number; reasoning: string }

    if (!decision.shouldBuy) return

    const fundsBnb = Math.min(decision.amountBnb ?? 0.05, MAX_POSITION_BNB).toString()
    await runBuyGuards(agentId, tokenAddress, parseFloat(fundsBnb))

    const quote  = await quoteBuy(tokenAddress, fundsBnb)
    const bought = await buyToken(tokenAddress, fundsBnb)

    const trade = await recordTrade({
      agent_id:        agentId,
      token_address:   tokenAddress,
      action:          'buy',
      amount_wei:      ethers.parseEther(fundsBnb).toString(),
      token_amount_wei: bought.tokenAmount.toString(),
      tx_hash:         bought.txHash,
    })

    positions.set(tokenAddress, {
      entryFundsBnb:  parseFloat(fundsBnb),
      tokenAmountWei: bought.tokenAmount.toString(),
      entryTradeId:   trade.id,
      entryTimestamp: Date.now(),
    })

    await logTradeExecuted(agentId, agent.owner_wallet, 'buy', tokenAddress, parseFloat(fundsBnb), decision.reasoning)

    // Mirror to copy-agent followers
    await mirrorBuyToFollowers(agentId, tokenAddress, parseFloat(fundsBnb))

    console.log(`[hybrid:${agent.name}] Bought ${tokenAddress} for ${fundsBnb} BNB`)
  } catch (err) {
    console.warn(`[hybrid] Buy eval failed for ${tokenAddress}:`, err)
  }
}

// ── Sell evaluation ───────────────────────────────────────

async function evaluateSell(
  agentId: string,
  agent: Awaited<ReturnType<typeof getAgentById>>,
  tokenAddress: string,
  pos: { entryFundsBnb: number; tokenAmountWei: string; entryTradeId: string }
) {
  try {
    const quote       = await quoteSell(tokenAddress, pos.tokenAmountWei)
    const returnBnb   = parseFloat(ethers.formatEther(quote.fundsReturn))
    const pnlPct      = ((returnBnb - pos.entryFundsBnb) / pos.entryFundsBnb) * 100

    const shouldExit  = pnlPct >= PROFIT_TARGET_PCT || pnlPct <= -STOP_LOSS_PCT
    if (!shouldExit) return

    const reason = pnlPct >= PROFIT_TARGET_PCT ? 'profit target hit' : 'stop loss triggered'
    const sold   = await sellToken(tokenAddress, pos.tokenAmountWei)

    const trade  = await recordTrade({
      agent_id:        agentId,
      token_address:   tokenAddress,
      action:          'sell',
      amount_wei:      pos.tokenAmountWei,
      token_amount_wei: quote.fundsReturn.toString(),
      tx_hash:         sold.txHash,
    })

    const pnlBnb = returnBnb - pos.entryFundsBnb
    await recordPnl(trade.id, pnlBnb)

    // Route profit to owner
    if (pnlBnb > 0) {
      const profitWei = ethers.parseEther(pnlBnb.toFixed(8)).toString()
      const txHash    = await sendBnb(agent.owner_wallet, profitWei)
      await logProfitSent(agentId, agent.owner_wallet, pnlBnb, txHash)
    }

    await logTradeExecuted(agentId, agent.owner_wallet, 'sell', tokenAddress, returnBnb, reason, pnlBnb)
    await mirrorSellToFollowers(agentId, tokenAddress, pos.tokenAmountWei)

    positions.delete(tokenAddress)
    console.log(`[hybrid:${agent.name}] Sold ${tokenAddress} — P&L: ${pnlBnb.toFixed(4)} BNB (${reason})`)
  } catch (err) {
    console.warn(`[hybrid] Sell eval failed for ${tokenAddress}:`, err)
  }
}

// ── Kimi K2: ideate meme concept ──────────────────────────

interface MemeConcept {
  tokenName: string
  symbol:    string
  description: string
  label:     'AI' | 'Meme' | 'Games' | 'Social' | 'Others'
  assetType: 'image' | 'video'
}

async function ideateWithKimi(trendCtx: string, agentName: string): Promise<MemeConcept> {
  const msgs: ChatCompletionMessageParam[] = [
    { role: 'system', content: HYBRID_AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `You are ${agentName}. Trends:\n${trendCtx}\n\nCreate a meme token. JSON only:\n{"tokenName":"<max 20 chars>","symbol":"<max 8 chars uppercase>","description":"<max 100 chars>","label":"AI"|"Meme"|"Games"|"Social"|"Others","assetType":"image"|"video"}`
    }
  ]
  const resp = await kimiChat({ messages: msgs, temperature: 0.8, maxTokens: 256 })
  try {
    return JSON.parse(resp.content.trim()) as MemeConcept
  } catch {
    return { tokenName: 'Sixteen Meme', symbol: 'SXTEEN', description: 'AI meme on BNB', label: 'Meme', assetType: 'image' }
  }
}

// ── EIP-8004 identity ─────────────────────────────────────

async function ensureIdentity(agentId: string, name: string, wallet: string) {
  try {
    const bal = await getAgentIdentityBalance(wallet)
    if (bal > 0) return
    const r = await registerAgentIdentity(name, '', `Sixteen hybrid agent — ${name}`)
    console.log(`[hybrid:${name}] EIP-8004 registered — tokenId: ${r.tokenId}`)
  } catch { /* non-fatal */ }
}
