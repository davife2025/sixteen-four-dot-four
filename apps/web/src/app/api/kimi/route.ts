// ============================================================
// SIXTEEN — apps/web/src/app/api/kimi/route.ts
//
// Kimi K2 handles ALL AI on this platform.
//
// Modes:
//   enhance-prompt  → rewrite user prompt for better image generation
//   describe        → token name/symbol/description from meme concept
//   score           → virality score 0-100
//   risk            → token risk analysis
//   trends          → 5 hot meme concepts right now
//   agent-decision  → should agent buy/sell/skip this token?
//   agent-concept   → what meme should the agent create?
//   chat            → onboarding assistant
//   performance     → explain agent P&L in plain English
// ============================================================

import { NextRequest } from 'next/server'

export const runtime  = 'edge'
export const maxDuration = 60

const HF_BASE = 'https://router.huggingface.co/v1'
const MODEL   = 'moonshotai/Kimi-K2-Instruct-0905'

const PROMPTS: Record<string, string> = {

  'enhance-prompt': `You are an expert AI image generation prompt engineer specialising in internet meme culture and crypto.
Given a meme concept, rewrite it as a detailed, vivid prompt for Flux AI image generation.
Output ONLY the enhanced prompt — no labels, no explanation.
Max 80 words. Include art style, key visual elements, mood, lighting.
Make it funny, viral, crypto-culture relevant. No text overlays in the image.`,

  describe: `You are a crypto meme token expert on BNB Chain.
Given a meme concept, generate token details.
Respond ONLY with valid JSON — no markdown, no explanation:
{"name":"string (max 20 chars)","symbol":"string (3-8 uppercase letters)","description":"string (max 120 chars, punchy)","category":"Meme|AI|Games|Social|Others"}`,

  score: `You are a viral meme analyst for BNB Chain meme culture.
Score the virality potential of a meme concept from 0-100.
Respond ONLY with valid JSON:
{"score":number,"reason":"string (max 80 chars)","verdict":"hot|warm|cold"}`,

  risk: `You are a crypto token analyst. Given token data, produce a risk assessment.
Respond ONLY with valid JSON:
{"risk":"low|medium|high","summary":"string (max 100 chars)","flags":["string"],"opportunity":"string (max 80 chars)"}`,

  trends: `You are plugged into crypto Twitter and BNB Chain meme culture right now.
Generate 5 hot meme concepts that would perform well as tokens on four.meme.
Respond ONLY with a JSON array:
[{"concept":"string","prompt":"string (image prompt, max 60 chars)","why":"string (max 50 chars)"}]`,

  'agent-decision': `You are an AI trading agent on the Sixteen platform operating on BNB Chain.
You have just received data about a meme token on four.meme's bonding curve.
Decide whether to BUY, SELL, or SKIP based on the data provided.
Respond ONLY with valid JSON:
{"action":"buy|sell|skip","amount_bnb":number|null,"confidence":number,"reasoning":"string (max 100 chars)"}
Rules: only buy if bonding curve < 40% filled and virality > 60. Skip high creator tax tokens.`,

  'agent-concept': `You are a creative AI agent that creates viral meme tokens on BNB Chain.
Given current trends, generate ONE meme token concept to launch right now.
Respond ONLY with valid JSON:
{"tokenName":"string (max 20 chars)","symbol":"string (3-8 uppercase)","description":"string (max 100 chars)","imagePrompt":"string (detailed image generation prompt, max 80 words)","label":"Meme|AI|Games|Social","reasoning":"string (max 80 chars)","viralityScore":number}`,

  chat: `You are the friendly assistant for Sixteen — a meme token platform on BNB Chain where:
- Humans upload or AI-generate memes and tokenize them, earning royalties on every trade forever
- AI agents (powered by Kimi K2) autonomously create and trade meme tokens, sending profits to the owner's wallet
- Everything launches on four.meme's bonding curve

Be warm, concise (max 3 sentences unless asked for detail). Explain jargon simply.
When you have enough info to recommend an agent type, end with: RECOMMEND:[creator|trader|hybrid]`,

  performance: `You are analysing an AI trading agent's performance on Sixteen.
Write a clear 2-3 sentence explanation of what the data shows.
Identify the main pattern and end with one concrete improvement suggestion.
Plain English — no jargon.`,
}

// Temperatures per mode
const TEMPS: Record<string, number> = {
  'enhance-prompt': 0.85,
  describe:         0.4,
  score:            0.3,
  risk:             0.3,
  trends:           0.9,
  'agent-decision': 0.2,
  'agent-concept':  0.85,
  chat:             0.75,
  performance:      0.4,
}

const MAX_TOKENS: Record<string, number> = {
  'enhance-prompt': 150,
  describe:         200,
  score:            100,
  risk:             250,
  trends:           400,
  'agent-decision': 150,
  'agent-concept':  350,
  chat:             512,
  performance:      300,
}

// Fallbacks when Kimi is unavailable
function fallback(mode: string, data: Record<string, unknown>): string {
  if (mode === 'describe')        return JSON.stringify({ name:'Meme Token', symbol:'MEME', description:'A viral meme on BNB Chain.', category:'Meme' })
  if (mode === 'score')           return JSON.stringify({ score:60, reason:'Could not analyse right now.', verdict:'warm' })
  if (mode === 'risk')            return JSON.stringify({ risk:'medium', summary:'Analysis unavailable.', flags:[], opportunity:'Review manually.' })
  if (mode === 'agent-decision')  return JSON.stringify({ action:'skip', amount_bnb:null, confidence:0, reasoning:'Kimi unavailable — defaulting to skip.' })
  if (mode === 'enhance-prompt')  return String(data['prompt'] ?? '')
  if (mode === 'trends') return JSON.stringify([
    { concept:'BNB Frog',    prompt:'cartoon frog holding BNB coin on the moon',    why:'BNB classic' },
    { concept:'Kimi Agent',  prompt:'robot AI agent trading crypto on laptop',       why:'AI × meme trend' },
    { concept:'Moon Doge',   prompt:'doge astronaut floating in space with BNB',     why:'Always viral' },
    { concept:'CZ Returns',  prompt:'anime character with rocket and Binance logo',  why:'Community favourite' },
    { concept:'Pepe on BSC', prompt:'Pepe frog surfing a BNB blockchain wave',       why:'Cross-chain narrative' },
  ])
  return 'Kimi K2 is currently unavailable.'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      mode:      string
      messages?: Array<{ role: 'user'|'assistant'|'system'; content: string }>
      data?:     Record<string, unknown>
      stream?:   boolean
    }

    const { mode, messages = [], data = {}, stream = false } = body
    const system = PROMPTS[mode]

    if (!system) {
      return new Response(JSON.stringify({ error: `Unknown mode: ${mode}` }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    const hfToken = process.env['HF_TOKEN']
    if (!hfToken) {
      return new Response(JSON.stringify({ content: fallback(mode, data) }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build messages
    const msgs = [{ role: 'system', content: system }]

    // For data-driven modes, inject data as the user message
    if (messages.length === 0 && Object.keys(data).length > 0) {
      msgs.push({ role: 'user', content: JSON.stringify(data) })
    } else {
      msgs.push(...messages)
    }

    const res = await fetch(`${HF_BASE}/chat/completions`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       MODEL,
        messages:    msgs,
        stream,
        temperature: TEMPS[mode] ?? 0.5,
        max_tokens:  MAX_TOKENS[mode] ?? 300,
      }),
    })

    if (!res.ok) {
      console.error('[kimi] HF error:', res.status, await res.text())
      return new Response(JSON.stringify({ content: fallback(mode, data) }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (stream) {
      return new Response(res.body, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    const json = await res.json() as { choices: Array<{ message: { content: string } }> }
    const content = json.choices[0]?.message?.content ?? fallback(mode, data)

    return new Response(JSON.stringify({ content }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[kimi]', err)
    return new Response(JSON.stringify({ error: 'Kimi K2 unavailable' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
