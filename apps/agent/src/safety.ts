// ============================================================
// SIXTEEN — apps/agent/src/safety.ts
// Agent safety guards — protects against runaway agents,
// excessive spending, spam launches, and wallet exposure.
// All guards run before any four.meme skill is executed.
// ============================================================

import { ethers } from 'ethers'
import { getProvider, getSigner } from '@sixteen/blockchain'
import { db } from '@sixteen/db'

// ── Spend limits per agent per cycle ─────────────────────

const MAX_BNB_PER_CYCLE        = 0.5    // max BNB spent in one 2-min cycle
const MAX_TOKENS_PER_ROUND     = 3      // max token launches per competition round
const MIN_BNB_BALANCE          = 0.01   // agent must keep this reserve
const MAX_CONCURRENT_POSITIONS = 5      // max open trade positions

// ── In-memory spend tracker (resets each cycle) ───────────

const cycleSpend = new Map<string, number>()  // agentId → BNB spent this cycle

export function resetCycleSpend(agentId: string): void {
  cycleSpend.set(agentId, 0)
}

export function trackSpend(agentId: string, bnbAmount: number): void {
  const current = cycleSpend.get(agentId) ?? 0
  cycleSpend.set(agentId, current + bnbAmount)
}

// ── Guard: check cycle spend limit ───────────────────────

export async function guardCycleSpend(agentId: string, proposedBnb: number): Promise<void> {
  const spent = cycleSpend.get(agentId) ?? 0
  if (spent + proposedBnb > MAX_BNB_PER_CYCLE) {
    throw new Error(
      `[safety] Cycle spend limit reached: ${spent.toFixed(4)} BNB spent, ` +
      `proposing ${proposedBnb} BNB — max is ${MAX_BNB_PER_CYCLE} BNB per cycle`
    )
  }
}

// ── Guard: check agent wallet balance ────────────────────

export async function guardWalletBalance(proposedBnb: number): Promise<void> {
  const signer   = getSigner()
  const provider = getProvider()
  const balance  = await provider.getBalance(signer.address)
  const balanceBnb = parseFloat(ethers.formatEther(balance))

  if (balanceBnb - proposedBnb < MIN_BNB_BALANCE) {
    throw new Error(
      `[safety] Insufficient wallet balance: ${balanceBnb.toFixed(4)} BNB, ` +
      `proposed spend ${proposedBnb} BNB would drop below reserve ${MIN_BNB_BALANCE} BNB`
    )
  }
}

// ── Guard: check token launch count for this round ───────

export async function guardLaunchCount(agentId: string): Promise<void> {
  // Get current active round
  const { data: round } = await db()
    .from('competition_rounds')
    .select('id')
    .eq('status', 'active')
    .single()

  if (!round) return  // no active round — no limit applies

  // Count launches in this round
  const { count, error } = await db()
    .from('meme_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('creator_agent_id', agentId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if (error) throw error

  if ((count ?? 0) >= MAX_TOKENS_PER_ROUND) {
    throw new Error(
      `[safety] Token launch limit reached: ${count}/${MAX_TOKENS_PER_ROUND} launches this round`
    )
  }
}

// ── Guard: validate token address is a real BEP-20 ────────

export async function guardValidToken(tokenAddress: string): Promise<void> {
  if (!ethers.isAddress(tokenAddress)) {
    throw new Error(`[safety] Invalid token address: ${tokenAddress}`)
  }
  const provider = getProvider()
  const code = await provider.getCode(tokenAddress)
  if (code === '0x' || code === '0x0') {
    throw new Error(`[safety] No contract at address: ${tokenAddress}`)
  }
}

// ── Guard: validate meme content (no empty names/symbols) ─

export function guardMemeContent(params: {
  name: string
  symbol: string
  description: string
  imageUrl: string
}): void {
  if (!params.name || params.name.trim().length < 2) {
    throw new Error('[safety] Token name too short (min 2 chars)')
  }
  if (params.name.length > 20) {
    throw new Error('[safety] Token name too long (max 20 chars)')
  }
  if (!params.symbol || params.symbol.trim().length < 2) {
    throw new Error('[safety] Token symbol too short (min 2 chars)')
  }
  if (params.symbol.length > 8) {
    throw new Error('[safety] Token symbol too long (max 8 chars)')
  }
  if (!params.imageUrl.startsWith('https://')) {
    throw new Error('[safety] Image URL must be HTTPS')
  }
  if (!params.imageUrl.includes('four.meme') && !params.imageUrl.includes('static.four')) {
    throw new Error('[safety] Image must be uploaded to four.meme before token creation')
  }
}

// ── Guard: validate tax rates sum to 100 ─────────────────

export function guardTaxRates(params: {
  burnRate: number
  divideRate: number
  liquidityRate: number
  recipientRate: number
}): void {
  const sum = params.burnRate + params.divideRate + params.liquidityRate + params.recipientRate
  if (sum !== 100) {
    throw new Error(`[safety] Tax rates must sum to 100, got ${sum}`)
  }
  if (params.recipientRate < 20) {
    throw new Error('[safety] Creator recipientRate should be at least 20% for meaningful earnings')
  }
}

// ── Master guard: run all relevant checks before a buy ────

export async function runBuyGuards(
  agentId: string,
  tokenAddress: string,
  fundsBnb: number
): Promise<void> {
  await guardCycleSpend(agentId, fundsBnb)
  await guardWalletBalance(fundsBnb)
  await guardValidToken(tokenAddress)
  trackSpend(agentId, fundsBnb)
}

// ── Master guard: run all checks before a token launch ────

export async function runCreateGuards(
  agentId: string,
  params: {
    name: string
    symbol: string
    description: string
    imageUrl: string
    burnRate: number
    divideRate: number
    liquidityRate: number
    recipientRate: number
    preSaleBnb?: number
  }
): Promise<void> {
  await guardLaunchCount(agentId)
  guardMemeContent(params)
  guardTaxRates(params)
  if (params.preSaleBnb) {
    await guardCycleSpend(agentId, params.preSaleBnb)
    await guardWalletBalance(params.preSaleBnb)
    trackSpend(agentId, params.preSaleBnb)
  }
}
