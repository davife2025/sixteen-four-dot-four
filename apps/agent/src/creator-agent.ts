// ============================================================
// SIXTEEN — apps/agent/src/creator-agent.ts
// Creator Agent — autonomous meme token creator
// Uses Kimi K2 to decide what to create, then executes
// the full pipeline: trend → ideate → generate → score → launch
// ============================================================

import {
  kimiChat,
  CREATOR_AGENT_SYSTEM_PROMPT,
  FOURMEME_TOOLS,
} from '@sixteen/ai'
import {
  createMemeToken,
  uploadMemeImage,
  getAgentWalletAddress,
  registerAgentIdentity,
  getAgentIdentityBalance,
  getPlatformConfig,
} from '@sixteen/blockchain'
import {
  insertMemeToken,
  updateAgentStatus,
  recordTrade,
  getAgentById,
} from '@sixteen/db'
import { getTopTrends, formatTrendsForKimi } from './trends'
import { scoreMemeVirality } from './virality'
import { getBestStaticMeme, uploadMemeToFourMeme, generateVideoMeme, downloadImageAsBuffer } from './memegen'
import type { ChatCompletionMessageParam } from 'openai/resources/chat'

// ── Min virality score to allow launch ────────────────────
const VIRALITY_THRESHOLD = 60

// ── Creator agent main loop ───────────────────────────────

export async function runCreatorAgent(agentId: string): Promise<void> {
  const agent = await getAgentById(agentId)
  console.log(`[creator] Starting agent: ${agent.name} (${agent.wallet_address})`)

  // Ensure agent has EIP-8004 identity for Insider Phase access
  await ensureAgentIdentity(agentId, agent.name, agent.wallet_address)

  await updateAgentStatus(agentId, 'running')

  try {
    // Step 1: Get current trends
    console.log('[creator] Fetching trends...')
    const trends = await getTopTrends(5)
    const trendContext = formatTrendsForKimi(trends)
    console.log(`[creator] Top trends:\n${trendContext}`)

    // Step 2: Ask Kimi K2 to ideate a meme concept
    const concept = await ideateMemeConcept(trendContext, agent.name)
    console.log(`[creator] Kimi K2 concept: ${concept.tokenName} — ${concept.description}`)

    // Step 3: Score virality before proceeding
    const viralityResult = await scoreMemeVirality(
      concept.description,
      trendContext,
      concept.tokenName
    )
    console.log(`[creator] Virality score: ${viralityResult.score} — ${viralityResult.recommendation}`)

    if (viralityResult.recommendation === 'ABORT') {
      console.log('[creator] Virality too low — skipping launch')
      await updateAgentStatus(agentId, 'idle')
      return
    }

    if (viralityResult.recommendation === 'WAIT') {
      console.log(`[creator] Waiting — ${viralityResult.suggestedTiming ?? 'try again later'}`)
      await updateAgentStatus(agentId, 'idle')
      return
    }

    // Step 4: Generate meme image OR video
    let fourMemeImageUrl: string
    let videoUrl: string | undefined

    if (concept.assetType === 'video') {
      console.log('[creator] Generating video meme via Kling 2.6...')
      const video = await generateVideoMeme(concept.description)
      videoUrl = video.videoUrl
      // Upload thumbnail as the four.meme token image
      const thumbBuffer = await downloadImageAsBuffer(video.thumbnailUrl)
      fourMemeImageUrl = await uploadMemeImage(thumbBuffer, 'image/jpeg')
      console.log(`[creator] Video generated: ${videoUrl}`)
    } else {
      console.log('[creator] Generating static meme via Supermeme.ai...')
      const meme = await getBestStaticMeme(concept.description)
      fourMemeImageUrl = await uploadMemeToFourMeme(meme.imageUrl)
      console.log(`[creator] Image generated and uploaded: ${fourMemeImageUrl}`)
    }

    // Step 5: Launch token on four.meme
    console.log(`[creator] Launching token: ${concept.tokenName} (${concept.symbol})...`)
    const ownerWallet = agent.owner_wallet

    const result = await createMemeToken({
      name: concept.tokenName,
      shortName: concept.symbol,
      description: concept.description,
      imageUrl: fourMemeImageUrl,
      label: concept.label,
      preSaleBnb: '0.01',        // agent pre-buys a small amount
      feeRate: 5,
      burnRate: 10,
      divideRate: 40,
      liquidityRate: 10,
      recipientRate: 40,
      recipientAddress: ownerWallet,  // owner earns royalties
      feePlan: true,              // anti-sniper enabled
    })

    console.log(`[creator] Token launched! Address: ${result.tokenAddress} tx: ${result.txHash}`)

    // Step 6: Record in Supabase
    await insertMemeToken({
      token_address: result.tokenAddress,
      name: concept.tokenName,
      symbol: concept.symbol,
      description: concept.description,
      image_url: fourMemeImageUrl,
      video_url: videoUrl,
      asset_type: concept.assetType,
      label: concept.label,
      creator_agent_id: agentId,
      creator_wallet: agent.wallet_address,
      tax_fee_rate: 5,
      burn_rate: 10,
      divide_rate: 40,
      liquidity_rate: 10,
      recipient_rate: 40,
      virality_score: viralityResult.score,
      create_tx_hash: result.txHash,
    })

    // Record the pre-sale buy as a trade
    await recordTrade({
      agent_id: agentId,
      token_address: result.tokenAddress,
      action: 'buy',
      amount_wei: '10000000000000000', // 0.01 BNB in wei
      token_amount_wei: '0',           // filled from receipt in production
      tx_hash: result.txHash,
    })

    console.log(`[creator] ✓ Complete. Token ${concept.tokenName} is live on BNB testnet.`)
  } catch (err) {
    console.error('[creator] Error:', err)
    await updateAgentStatus(agentId, 'error')
    return
  }

  await updateAgentStatus(agentId, 'idle')
}

// ── Kimi K2: ideate a meme concept from trends ────────────

interface MemeConcept {
  tokenName: string
  symbol: string
  description: string
  label: 'AI' | 'Meme' | 'Games' | 'Social' | 'Defi' | 'Others'
  assetType: 'image' | 'video'
  reasoning: string
}

async function ideateMemeConcept(
  trendContext: string,
  agentName: string
): Promise<MemeConcept> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: CREATOR_AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `
You are ${agentName}, a creator agent on the Sixteen platform.

Current trending topics:
${trendContext}

Create a meme token concept. Respond ONLY with valid JSON, no markdown:
{
  "tokenName": "<full token name, max 20 chars>",
  "symbol": "<ticker, max 8 chars, uppercase>",
  "description": "<meme concept description, max 100 chars>",
  "label": "AI"|"Meme"|"Games"|"Social"|"Defi"|"Others",
  "assetType": "image"|"video",
  "reasoning": "<why this will be viral>"
}
      `.trim(),
    },
  ]

  const response = await kimiChat({
    messages,
    tools: FOURMEME_TOOLS,
    temperature: 0.8,  // slightly higher for creative ideation
    maxTokens: 512,
  })

  try {
    return JSON.parse(response.content.trim()) as MemeConcept
  } catch {
    // fallback concept if Kimi K2 doesn't return clean JSON
    return {
      tokenName: 'Sixteen Meme',
      symbol: 'SXTEEN',
      description: 'The future of AI meme trading on BNB Chain',
      label: 'Meme',
      assetType: 'image',
      reasoning: 'Fallback concept',
    }
  }
}

// ── EIP-8004 identity registration ────────────────────────

async function ensureAgentIdentity(
  agentId: string,
  agentName: string,
  walletAddress: string
): Promise<void> {
  try {
    const balance = await getAgentIdentityBalance(walletAddress)
    if (balance > 0) {
      console.log(`[creator] Agent already has EIP-8004 identity (balance: ${balance})`)
      return
    }
    console.log('[creator] Registering EIP-8004 identity for Insider Phase access...')
    const result = await registerAgentIdentity(
      agentName,
      '',
      `Sixteen creator agent — ${agentName}`
    )
    console.log(`[creator] EIP-8004 registered — tokenId: ${result.tokenId} tx: ${result.txHash}`)
  } catch (err) {
    console.warn('[creator] EIP-8004 registration failed (non-fatal):', err)
  }
}
