// ============================================================
// SIXTEEN — apps/agent/src/creator-agent.ts
// Creator Agent — autonomous meme token creator
//
// Every cycle:
//   1. Get current trends (CoinGecko + Twitter + Kimi fallback)
//   2. Kimi K2 ideates a meme concept
//   3. Kimi K2 scores virality (must be ≥60 to proceed)
//   4. HuggingFace FLUX generates the meme image
//   5. Image uploaded to four.meme CDN
//   6. Token launched on four.meme bonding curve
//   7. All actions logged to Supabase + owner notified
// ============================================================

import { kimiChat, CREATOR_AGENT_SYSTEM_PROMPT, FOURMEME_TOOLS } from '@sixteen/ai'
import {
  createMemeToken, uploadMemeImage, registerAgentIdentity,
  getAgentIdentityBalance,
} from '@sixteen/blockchain'
import {
  insertMemeToken, updateAgentStatus, recordTrade, getAgentById,
  upsertLeaderboard,
} from '@sixteen/db'
import { getTopTrends, formatTrendsForKimi }            from './trends'
import { scoreMemeVirality }                             from './virality'
import {
  getBestStaticMeme, uploadMemeToFourMeme,
  generateVideoMeme, downloadImageAsBuffer,
}                                                        from './memegen'
import {
  logAgentAction, logTokenLaunched,
}                                                        from './logger'
import { recordSuccess, recordFailure }                  from './monitor'
import type { ChatCompletionMessageParam }               from 'openai/resources/chat'

const VIRALITY_THRESHOLD = 60

// ── Main loop ─────────────────────────────────────────────

export async function runCreatorAgent(agentId: string): Promise<void> {
  const agent = await getAgentById(agentId)
  console.log(`[creator:${agent.name}] Starting cycle`)

  await ensureAgentIdentity(agentId, agent.name, agent.wallet_address)
  await updateAgentStatus(agentId, 'running')

  try {
    // 1. Trends
    const trends     = await getTopTrends(5)
    const trendCtx   = formatTrendsForKimi(trends)
    console.log(`[creator:${agent.name}] Trends:\n${trendCtx}`)

    // 2. Ideate concept
    const concept    = await ideateMemeConcept(trendCtx, agent.name)
    console.log(`[creator:${agent.name}] Concept: ${concept.tokenName} — ${concept.description}`)

    // 3. Score virality
    const virality   = await scoreMemeVirality(concept.description, trendCtx, concept.tokenName)
    console.log(`[creator:${agent.name}] Virality: ${virality.score} — ${virality.recommendation}`)

    if (virality.recommendation !== 'GO') {
      await logAgentAction({
        agent_id:       agentId,
        action:         'skip',
        reasoning:      `Virality ${virality.score}/100: ${virality.reasoning}`,
        virality_score: virality.score,
        outcome:        'skipped',
      })
      await updateAgentStatus(agentId, 'idle')
      return
    }

    // 4. Generate meme asset
    let fourMemeImageUrl: string
    let videoUrl: string | undefined

    if (concept.assetType === 'video') {
      console.log(`[creator:${agent.name}] Generating video via Kling…`)
      const video  = await generateVideoMeme(concept.description)
      videoUrl     = video.videoUrl ?? undefined
      const buf    = await downloadImageAsBuffer(video.thumbnailUrl)
      fourMemeImageUrl = await uploadMemeImage(buf, 'image/jpeg')
    } else {
      console.log(`[creator:${agent.name}] Generating image via HF FLUX…`)
      const meme       = await getBestStaticMeme(concept.description)
      fourMemeImageUrl = await uploadMemeToFourMeme(meme.imageUrl, meme.imageBuffer)
    }

    // 5. Launch on four.meme
    console.log(`[creator:${agent.name}] Launching ${concept.tokenName} (${concept.symbol})…`)
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
    console.log(`[creator:${agent.name}] Token launched: ${result.tokenAddress} tx: ${result.txHash}`)

    // 6. Record in Supabase
    await insertMemeToken({
      token_address:    result.tokenAddress,
      name:             concept.tokenName,
      symbol:           concept.symbol,
      description:      concept.description,
      image_url:        fourMemeImageUrl,
      video_url:        videoUrl,
      asset_type:       concept.assetType,
      label:            concept.label,
      creator_agent_id: agentId,
      creator_wallet:   agent.wallet_address,
      tax_fee_rate:     5,
      burn_rate:        10,
      divide_rate:      40,
      liquidity_rate:   10,
      recipient_rate:   40,
      virality_score:   virality.score,
      create_tx_hash:   result.txHash,
    })

    // Record pre-sale buy
    await recordTrade({
      agent_id:        agentId,
      token_address:   result.tokenAddress,
      action:          'buy',
      amount_wei:      '10000000000000000',  // 0.01 BNB
      token_amount_wei: '0',
      tx_hash:         result.txHash,
    })

    // Update leaderboard
    await upsertLeaderboard({
      agent_id:        agentId,
      total_pnl_bnb:   0,
      tokens_created:  1,
      trades_executed: 1,
    }).catch(() => null)

    // 7. Log + notify
    await logTokenLaunched(
      agentId, agent.owner_wallet,
      result.tokenAddress, concept.tokenName,
      virality.score, 0.01
    )

    recordSuccess(agentId)
    console.log(`[creator:${agent.name}] ✓ Complete`)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[creator:${agent.name}] Error:`, msg)
    await recordFailure(agentId, 'creator_cycle', msg)
    await logAgentAction({ agent_id: agentId, action: 'error', reasoning: msg, outcome: 'failed' })
    await updateAgentStatus(agentId, 'error')
    return
  }

  await updateAgentStatus(agentId, 'idle')
}

// ── Kimi K2: ideate meme concept ─────────────────────────

interface MemeConcept {
  tokenName:   string
  symbol:      string
  description: string
  label:       'AI' | 'Meme' | 'Games' | 'Social' | 'Others'
  assetType:   'image' | 'video'
  reasoning:   string
}

async function ideateMemeConcept(trendCtx: string, agentName: string): Promise<MemeConcept> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: CREATOR_AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `You are ${agentName}.\n\nCurrent trending topics:\n${trendCtx}\n\nCreate a meme token concept. Respond ONLY with valid JSON:\n{"tokenName":"<max 20 chars>","symbol":"<max 8 chars UPPERCASE>","description":"<max 100 chars>","label":"AI"|"Meme"|"Games"|"Social"|"Others","assetType":"image"|"video","reasoning":"<why viral>"}`,
    },
  ]

  const response = await kimiChat({ messages, tools: FOURMEME_TOOLS, temperature: 0.85, maxTokens: 400 })

  try {
    const clean = response.content.trim().replace(/```json\n?/g,'').replace(/```\n?/g,'')
    return JSON.parse(clean) as MemeConcept
  } catch {
    return { tokenName:'Sixteen Meme', symbol:'SXTEEN', description:'AI meme on BNB Chain', label:'Meme', assetType:'image', reasoning:'Fallback' }
  }
}

// ── EIP-8004 identity ─────────────────────────────────────

async function ensureAgentIdentity(agentId: string, name: string, wallet: string): Promise<void> {
  try {
    const balance = await getAgentIdentityBalance(wallet)
    if (balance > 0) return
    console.log(`[creator] Registering EIP-8004 identity for ${name}…`)
    const result = await registerAgentIdentity(name, '', `Sixteen creator agent — ${name}`)
    console.log(`[creator] EIP-8004 registered — tokenId: ${result.tokenId}`)
  } catch (err) {
    console.warn('[creator] EIP-8004 registration failed (non-fatal):', (err as Error).message)
  }
}
