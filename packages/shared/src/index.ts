// ============================================================
// SIXTEEN — Shared Types
// Used across apps/web, apps/agent, apps/api, packages/*
// ============================================================

// ── Agent types ──────────────────────────────────────────

export type AgentType = 'creator' | 'trader' | 'hybrid'

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error'

export interface Agent {
  id: string
  owner_wallet: string
  name: string
  type: AgentType
  status: AgentStatus
  wallet_address: string   // agent's own on-chain wallet
  eip8004_token_id: string | null  // registered identity NFT
  created_at: string
  updated_at: string
}

// ── Meme token types ──────────────────────────────────────

export type MemeAssetType = 'image' | 'video'

export type TokenPhase = 'insider' | 'public' | 'graduated'

export interface MemeToken {
  id: string
  token_address: string
  name: string
  symbol: string
  description: string
  image_url: string
  video_url: string | null        // null for image memes
  asset_type: MemeAssetType
  label: string                   // AI / Meme / Games / Social etc
  creator_agent_id: string
  creator_wallet: string
  tax_fee_rate: number            // e.g. 5 = 5%
  recipient_rate: number          // creator's cut
  virality_score: number          // 0-100 pre-launch score
  phase: TokenPhase
  bonding_curve_pct: number       // 0-100
  sixteen_score: number           // platform ranking score
  created_at: string
}

// ── Trade types ───────────────────────────────────────────

export type TradeAction = 'buy' | 'sell'

export interface AgentTrade {
  id: string
  agent_id: string
  token_address: string
  action: TradeAction
  amount_wei: string              // BNB amount in wei
  token_amount_wei: string        // token amount in wei
  tx_hash: string
  pnl_bnb: number | null          // realised P&L after sell
  created_at: string
}

// ── Competition types ─────────────────────────────────────

export type RoundStatus = 'pending' | 'active' | 'ended'

export interface CompetitionRound {
  id: string
  status: RoundStatus
  started_at: string | null
  ended_at: string | null
  prize_pool_bnb: number
  winner_agent_id: string | null
}

export interface LeaderboardEntry {
  agent_id: string
  agent_name: string
  agent_type: AgentType
  owner_wallet: string
  total_pnl_bnb: number
  tokens_created: number
  trades_executed: number
  rank: number
}

// ── Kimi K2 tool call types ───────────────────────────────

export interface KimiToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface AgentDecision {
  action: 'create_meme' | 'create_video' | 'buy' | 'sell' | 'hold' | 'wait'
  reasoning: string
  tool_calls: KimiToolCall[]
  confidence: number  // 0-1
}

// ── API response wrapper ──────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}
