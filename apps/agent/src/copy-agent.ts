// ============================================================
// SIXTEEN — apps/agent/src/copy-agent.ts
// Copy-Agent engine — mirrors winning agent trades to followers
// Followers stake BNB and proportionally mirror every
// buy/sell the followed agent makes automatically.
// ============================================================

import { ethers } from 'ethers'
import {
  quoteBuy,
  buyToken,
  quoteSell,
  sellToken,
  getSigner,
  getProvider,
} from '@sixteen/blockchain'
import { db, recordTrade } from '@sixteen/db'

// ── Copy fee: 1.5% of each mirrored trade goes to agent owner ─

const COPY_FEE_BPS = 150  // 1.5%

// ── Mirror a buy trade to all active followers ────────────

export async function mirrorBuyToFollowers(
  sourceAgentId: string,
  tokenAddress: string,
  sourceFundsBnb: number
): Promise<void> {
  const followers = await getActiveFollowers(sourceAgentId)
  if (!followers.length) return

  console.log(`[copy] Mirroring buy of ${tokenAddress} to ${followers.length} followers`)

  await Promise.allSettled(
    followers.map((follower) =>
      executeCopyBuy(follower, sourceAgentId, tokenAddress, sourceFundsBnb)
    )
  )
}

// ── Mirror a sell trade to all active followers ───────────

export async function mirrorSellToFollowers(
  sourceAgentId: string,
  tokenAddress: string,
  sourceTokenAmountWei: string
): Promise<void> {
  const followers = await getActiveFollowers(sourceAgentId)
  if (!followers.length) return

  console.log(`[copy] Mirroring sell of ${tokenAddress} to ${followers.length} followers`)

  await Promise.allSettled(
    followers.map((follower) =>
      executeCopySell(follower, sourceAgentId, tokenAddress, sourceTokenAmountWei)
    )
  )
}

// ── Execute a proportional buy for one follower ───────────

interface Follower {
  id: string
  follower_wallet: string
  agent_id: string
  stake_bnb: number
}

async function executeCopyBuy(
  follower: Follower,
  sourceAgentId: string,
  tokenAddress: string,
  sourceFundsBnb: number
): Promise<void> {
  try {
    // Proportional amount: follower's stake relative to a baseline of 0.1 BNB
    const baselineSourceBnb = 0.1
    const ratio             = follower.stake_bnb / baselineSourceBnb
    const rawAmount         = sourceFundsBnb * ratio

    // Apply copy fee
    const fee           = rawAmount * (COPY_FEE_BPS / 10000)
    const followerAmount = rawAmount - fee

    if (followerAmount < 0.001) {
      console.log(`[copy] Follower ${follower.follower_wallet} amount too small — skipping`)
      return
    }

    const fundsBnb = followerAmount.toFixed(6)

    // Get quote first
    const quote = await quoteBuy(tokenAddress, fundsBnb)
    console.log(`[copy] Follower buy: ${follower.follower_wallet} — ${fundsBnb} BNB → ${ethers.formatEther(quote.tokenAmount)} tokens`)

    // Execute buy using follower's wallet
    // NOTE: In production each follower has their own wallet keypair
    // For testnet, we use the shared agent wallet (simplified)
    const result = await buyToken(tokenAddress, fundsBnb)

    // Record in Supabase
    await recordTrade({
      agent_id: sourceAgentId,
      token_address: tokenAddress,
      action: 'buy',
      amount_wei: ethers.parseEther(fundsBnb).toString(),
      token_amount_wei: result.tokenAmount.toString(),
      tx_hash: result.txHash,
    })

    console.log(`[copy] ✓ Follower buy executed: ${result.txHash}`)
  } catch (err) {
    console.warn(`[copy] Failed buy for follower ${follower.follower_wallet}:`, err)
  }
}

// ── Execute a proportional sell for one follower ──────────

async function executeCopySell(
  follower: Follower,
  sourceAgentId: string,
  tokenAddress: string,
  sourceTokenAmountWei: string
): Promise<void> {
  try {
    // Scale token amount proportionally to follower's stake
    const baselineSourceBnb = 0.1
    const ratio             = follower.stake_bnb / baselineSourceBnb
    const sourceAmount      = BigInt(sourceTokenAmountWei)
    const followerAmount    = (sourceAmount * BigInt(Math.floor(ratio * 1000))) / 1000n

    if (followerAmount === 0n) return

    // Get quote
    const quote = await quoteSell(tokenAddress, followerAmount.toString())
    console.log(`[copy] Follower sell: ${follower.follower_wallet} — ${ethers.formatEther(followerAmount)} tokens → ${ethers.formatEther(quote.fundsReturn)} BNB`)

    // Execute sell
    const result = await sellToken(tokenAddress, followerAmount.toString())

    // Record in Supabase
    await recordTrade({
      agent_id: sourceAgentId,
      token_address: tokenAddress,
      action: 'sell',
      amount_wei: followerAmount.toString(),
      token_amount_wei: quote.fundsReturn.toString(),
      tx_hash: result.txHash,
    })

    console.log(`[copy] ✓ Follower sell executed: ${result.txHash}`)
  } catch (err) {
    console.warn(`[copy] Failed sell for follower ${follower.follower_wallet}:`, err)
  }
}

// ── Get active followers for an agent ────────────────────

async function getActiveFollowers(agentId: string): Promise<Follower[]> {
  const { data, error } = await db()
    .from('copy_follows')
    .select('id, follower_wallet, agent_id, stake_bnb')
    .eq('agent_id', agentId)
    .eq('active', true)

  if (error) {
    console.warn('[copy] Failed to fetch followers:', error)
    return []
  }
  return (data ?? []) as Follower[]
}
