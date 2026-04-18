// ============================================================
// SIXTEEN — packages/db
// Supabase client + typed query helpers
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Client factory ────────────────────────────────────────

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  }
  _client = createClient(url, key, {
    auth: { persistSession: false }
  })
  return _client
}

// Alias
export const db = () => getSupabaseClient()

// ── Agent queries ─────────────────────────────────────────

export async function getAgentById(agentId: string) {
  const { data, error } = await db()
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()
  if (error) throw error
  return data
}

export async function getRunningAgents() {
  const { data, error } = await db()
    .from('agents')
    .select('*')
    .eq('status', 'running')
  if (error) throw error
  return data ?? []
}

export async function updateAgentStatus(
  agentId: string,
  status: 'idle' | 'running' | 'paused' | 'error'
) {
  const { error } = await db()
    .from('agents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', agentId)
  if (error) throw error
}

// ── Meme token queries ────────────────────────────────────

export async function insertMemeToken(token: {
  token_address: string
  name: string
  symbol: string
  description: string
  image_url: string
  video_url?: string
  asset_type: 'image' | 'video'
  label: string
  creator_agent_id: string
  creator_wallet: string
  tax_fee_rate: number
  burn_rate: number
  divide_rate: number
  liquidity_rate: number
  recipient_rate: number
  virality_score: number
  create_tx_hash?: string
}) {
  const { data, error } = await db()
    .from('meme_tokens')
    .insert(token)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getTokenFeed(limit = 50) {
  const { data, error } = await db()
    .from('meme_tokens')
    .select('*')
    .order('sixteen_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function updateTokenPhase(
  tokenAddress: string,
  phase: 'insider' | 'public' | 'graduated',
  bondingCurvePct: number
) {
  const { error } = await db()
    .from('meme_tokens')
    .update({ phase, bonding_curve_pct: bondingCurvePct, updated_at: new Date().toISOString() })
    .eq('token_address', tokenAddress)
  if (error) throw error
}

// ── Trade queries ─────────────────────────────────────────

export async function recordTrade(trade: {
  agent_id: string
  token_address: string
  action: 'buy' | 'sell'
  amount_wei: string
  token_amount_wei: string
  tx_hash?: string
  round_id?: string
}) {
  const { data, error } = await db()
    .from('agent_trades')
    .insert(trade)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function recordPnl(tradeId: string, pnlBnb: number) {
  const { error } = await db()
    .from('agent_trades')
    .update({ pnl_bnb: pnlBnb })
    .eq('id', tradeId)
  if (error) throw error
}

// ── Leaderboard queries ───────────────────────────────────

export async function getLeaderboard(roundId?: string) {
  let query = db()
    .from('leaderboard')
    .select(`
      *,
      agents (name, type, owner_wallet)
    `)
    .order('total_pnl_bnb', { ascending: false })
  if (roundId) {
    query = query.eq('round_id', roundId)
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function upsertLeaderboard(entry: {
  agent_id: string
  round_id?: string
  total_pnl_bnb: number
  tokens_created: number
  trades_executed: number
}) {
  const { error } = await db()
    .from('leaderboard')
    .upsert({ ...entry, updated_at: new Date().toISOString() })
  if (error) throw error
}

// ── Competition round queries ─────────────────────────────

export async function getActiveRound() {
  const { data, error } = await db()
    .from('competition_rounds')
    .select('*')
    .eq('status', 'active')
    .single()
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
  return data ?? null
}

export async function createRound(durationHours = 24) {
  const { data, error } = await db()
    .from('competition_rounds')
    .insert({ duration_hours: durationHours })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function startRound(roundId: string) {
  const { error } = await db()
    .from('competition_rounds')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', roundId)
  if (error) throw error
}

export async function endRound(roundId: string, winnerAgentId: string) {
  const { error } = await db()
    .from('competition_rounds')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      winner_agent_id: winnerAgentId
    })
    .eq('id', roundId)
  if (error) throw error
}
