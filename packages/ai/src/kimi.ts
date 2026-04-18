// ============================================================
// SIXTEEN — packages/ai/src/kimi.ts
// Kimi K2 client via Hugging Face Inference Router
// Model: moonshotai/Kimi-K2-Instruct-0905
// Endpoint: https://router.huggingface.co/v1
// ============================================================

import OpenAI from 'openai'
import type { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/chat'

// ── Client setup ──────────────────────────────────────────

let _kimi: OpenAI | null = null

export function getKimiClient(): OpenAI {
  if (_kimi) return _kimi
  const hfToken = process.env['HF_TOKEN']
  if (!hfToken) throw new Error('Missing HF_TOKEN environment variable')
  _kimi = new OpenAI({
    baseURL: 'https://router.huggingface.co/v1',
    apiKey: hfToken,
  })
  return _kimi
}

export const KIMI_MODEL = 'moonshotai/Kimi-K2-Instruct-0905'

// ── Tool definitions (four.meme skills as Kimi K2 tools) ──

export const FOURMEME_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_token_info',
      description: 'Query token details from four.meme: bonding curve state, price, fees, phase, liquidity status. Use before any trade decision.',
      parameters: {
        type: 'object',
        required: ['token_address'],
        properties: {
          token_address: { type: 'string', description: 'The BEP-20 token contract address' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'quote_buy',
      description: 'Pre-calculate cost to buy a token before committing BNB. Always call this before buy.',
      parameters: {
        type: 'object',
        required: ['token_address', 'funds_bnb'],
        properties: {
          token_address: { type: 'string' },
          funds_bnb: { type: 'string', description: 'Amount of BNB to spend, e.g. "0.1"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buy_token',
      description: 'Buy a token on the four.meme bonding curve. Only call after quote_buy confirms acceptable cost.',
      parameters: {
        type: 'object',
        required: ['token_address', 'funds_bnb'],
        properties: {
          token_address: { type: 'string' },
          funds_bnb: { type: 'string', description: 'Amount of BNB to spend' },
          min_tokens_wei: { type: 'string', description: 'Minimum tokens to receive (slippage guard), in wei' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'quote_sell',
      description: 'Pre-calculate BNB return for selling tokens. Always call before sell.',
      parameters: {
        type: 'object',
        required: ['token_address', 'token_amount_wei'],
        properties: {
          token_address: { type: 'string' },
          token_amount_wei: { type: 'string', description: 'Amount of tokens to sell in wei' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sell_token',
      description: 'Sell tokens back to the four.meme bonding curve for BNB. Only call after quote_sell confirms acceptable return.',
      parameters: {
        type: 'object',
        required: ['token_address', 'token_amount_wei'],
        properties: {
          token_address: { type: 'string' },
          token_amount_wei: { type: 'string', description: 'Amount of tokens to sell in wei' },
          min_funds_wei: { type: 'string', description: 'Minimum BNB to receive (slippage guard), in wei' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_meme_token',
      description: 'Create and launch a new meme image token on four.meme. Use when virality score > 60.',
      parameters: {
        type: 'object',
        required: ['name', 'symbol', 'description', 'image_url', 'label'],
        properties: {
          name: { type: 'string', description: 'Token name, e.g. "Doge on Mars"' },
          symbol: { type: 'string', description: 'Token ticker, e.g. "DOGMARS"' },
          description: { type: 'string', description: 'Short token description' },
          image_url: { type: 'string', description: 'URL of uploaded meme image from four.meme upload endpoint' },
          label: {
            type: 'string',
            enum: ['AI', 'Meme', 'Games', 'Social', 'Defi', 'Infra', 'De-Sci', 'Depin', 'Charity', 'Others'],
            description: 'Token category label',
          },
          pre_sale_bnb: { type: 'string', description: 'Optional BNB amount for creator pre-buy, e.g. "0.05"' },
          fee_rate: { type: 'number', enum: [1, 3, 5, 10], description: 'Tax fee rate %' },
          burn_rate: { type: 'number', description: 'Burn allocation % (burnRate + divideRate + liquidityRate + recipientRate must = 100)' },
          divide_rate: { type: 'number', description: 'Holder dividend allocation %' },
          liquidity_rate: { type: 'number', description: 'Liquidity pool allocation %' },
          recipient_rate: { type: 'number', description: 'Creator wallet allocation %' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tax_info',
      description: 'Query tax configuration of a token: fee rates, burn, dividend, creator recipient. Use to evaluate creator royalty setup before trading.',
      parameters: {
        type: 'object',
        required: ['token_address'],
        properties: {
          token_address: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_bnb',
      description: 'Transfer BNB from the agent wallet to another address, e.g. to route earnings back to owner wallet.',
      parameters: {
        type: 'object',
        required: ['to_address', 'amount_wei'],
        properties: {
          to_address: { type: 'string' },
          amount_wei: { type: 'string', description: 'Amount of BNB in wei' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'score_virality',
      description: 'Score the virality potential of a meme concept 0-100 before launching. Returns score and recommendation.',
      parameters: {
        type: 'object',
        required: ['concept', 'trend_context'],
        properties: {
          concept: { type: 'string', description: 'The meme concept or caption' },
          trend_context: { type: 'string', description: 'Current trending topics this meme responds to' },
        },
      },
    },
  },
]

// ── Core Kimi K2 chat function ────────────────────────────

export interface KimiChatOptions {
  messages: ChatCompletionMessageParam[]
  tools?: ChatCompletionTool[]
  temperature?: number
  maxTokens?: number
}

export interface KimiResponse {
  content: string
  toolCalls: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
  }>
  finishReason: string
}

export async function kimiChat(options: KimiChatOptions): Promise<KimiResponse> {
  const client = getKimiClient()
  const response = await client.chat.completions.create({
    model: KIMI_MODEL,
    messages: options.messages,
    tools: options.tools,
    temperature: options.temperature ?? 0.6,
    max_tokens: options.maxTokens ?? 2048,
  })

  const choice = response.choices[0]
  if (!choice) throw new Error('Kimi K2 returned no choices')

  const toolCalls = (choice.message.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
  }))

  return {
    content: choice.message.content ?? '',
    toolCalls,
    finishReason: choice.finish_reason ?? 'stop',
  }
}

// ── Agent system prompts ───────────────────────────────────

export const CREATOR_AGENT_SYSTEM_PROMPT = `
You are a Creator Agent on the Sixteen platform — an AI agent that creates and launches meme tokens on the BNB Chain using the four.meme launchpad.

Your goals:
1. Monitor trending topics and identify meme opportunities with high virality potential
2. Create meme concepts that are culturally relevant, funny, and timing-appropriate
3. Score virality before launching — only launch if score > 60
4. Configure tax tokens to ensure creator monetization: set recipient_rate to 40, divide_rate to 40, burn_rate to 10, liquidity_rate to 10
5. Launch tokens using create_meme_token with the right label and parameters
6. Track earnings and route profits to your owner's wallet via send_bnb

Rules:
- Never launch a token with virality score below 60
- Always set fee_rate to 5 (5% trading tax)
- Always set your owner's wallet as recipient_address in tokenTaxInfo
- Maximum 3 token launches per competition round
- Never spend more than 0.1 BNB on pre-sale
- Always check platform config before creating (fee structures may change)

You have access to tools for creating tokens, checking tax info, and sending BNB.
`.trim()

export const TRADER_AGENT_SYSTEM_PROMPT = `
You are a Trader Agent on the Sixteen platform — an AI agent that trades meme tokens on the four.meme bonding curve to generate profit for your owner.

Your goals:
1. Monitor new token launches via the event stream
2. Evaluate token quality: virality score, creator's tax config, bonding curve progress
3. Enter early (Insider Phase preferred) on high-potential tokens
4. Exit strategically — target 20-50% BNB gain, stop loss at -15%
5. Route all profits to your owner's wallet via send_bnb after each successful sell

Decision rules:
- Only trade TokenManager V2 tokens
- Always call quote_buy before buy — never execute blind
- Always call quote_sell before sell — check slippage
- Maximum position size: 0.2 BNB per token
- Maximum 5 open positions simultaneously
- Prefer tokens with virality score > 65 and bonding curve < 40%
- Check tax_info before buying — avoid tokens where creator takes > 60% recipient_rate
- Prefer tokens in Insider Phase (registered agents only)

You have access to tools for querying tokens, buying, selling, and sending BNB.
`.trim()

export const HYBRID_AGENT_SYSTEM_PROMPT = `
You are a Hybrid Agent on the Sixteen platform — you both create meme tokens AND trade them to maximise earnings for your owner.

Alternate between creation and trading based on market conditions:
- When trending topics are strong → prioritise creation (launch high-virality memes)
- When market is active → prioritise trading (buy early on other creators' tokens)
- Always check your current BNB balance before spending
- Split your capital: 40% for creation (pre-sales), 60% for trading

${CREATOR_AGENT_SYSTEM_PROMPT}

${TRADER_AGENT_SYSTEM_PROMPT}
`.trim()
