-- ============================================================
-- SIXTEEN — Supabase Migration 001
-- Full database schema
-- Run: supabase db push
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── USERS ────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default uuid_generate_v4(),
  wallet      text not null unique,  -- owner wallet address
  username    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── AGENTS ───────────────────────────────────────────────
create type public.agent_type   as enum ('creator', 'trader', 'hybrid');
create type public.agent_status as enum ('idle', 'running', 'paused', 'error');

create table if not exists public.agents (
  id                  uuid primary key default uuid_generate_v4(),
  owner_wallet        text not null references public.users(wallet),
  name                text not null,
  type                public.agent_type not null default 'hybrid',
  status              public.agent_status not null default 'idle',
  wallet_address      text not null unique,   -- agent's own wallet
  eip8004_token_id    text,                   -- on-chain identity NFT id
  system_prompt       text,                   -- Kimi K2 system prompt for this agent
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on public.agents(owner_wallet);
create index on public.agents(status);

-- ── MEME TOKENS ──────────────────────────────────────────
create type public.meme_asset_type as enum ('image', 'video');
create type public.token_phase     as enum ('insider', 'public', 'graduated');

create table if not exists public.meme_tokens (
  id                  uuid primary key default uuid_generate_v4(),
  token_address       text not null unique,
  name                text not null,
  symbol              text not null,
  description         text not null default '',
  image_url           text not null,
  video_url           text,                     -- null for image memes
  asset_type          public.meme_asset_type not null default 'image',
  label               text not null default 'Meme',
  creator_agent_id    uuid references public.agents(id),
  creator_wallet      text not null,
  -- tokenTaxInfo
  tax_fee_rate        integer not null default 5,   -- 1,3,5,10
  burn_rate           integer not null default 10,
  divide_rate         integer not null default 40,
  liquidity_rate      integer not null default 10,
  recipient_rate      integer not null default 40,
  -- state
  phase               public.token_phase not null default 'insider',
  bonding_curve_pct   numeric(5,2) not null default 0,
  virality_score      integer not null default 0,   -- 0-100 pre-launch
  sixteen_score       numeric(8,2) not null default 0,
  -- on-chain tx
  create_tx_hash      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on public.meme_tokens(creator_agent_id);
create index on public.meme_tokens(phase);
create index on public.meme_tokens(sixteen_score desc);
create index on public.meme_tokens(created_at desc);

-- ── AGENT TRADES ─────────────────────────────────────────
create type public.trade_action as enum ('buy', 'sell');

create table if not exists public.agent_trades (
  id                uuid primary key default uuid_generate_v4(),
  agent_id          uuid not null references public.agents(id),
  token_address     text not null,
  action            public.trade_action not null,
  amount_wei        text not null,          -- BNB in wei (string to avoid precision loss)
  token_amount_wei  text not null,          -- token amount in wei
  tx_hash           text,
  pnl_bnb           numeric(18,8),          -- realised P&L after sell (null until sold)
  round_id          uuid,                   -- which competition round
  created_at        timestamptz not null default now()
);

create index on public.agent_trades(agent_id);
create index on public.agent_trades(token_address);
create index on public.agent_trades(round_id);

-- ── COMPETITION ROUNDS ────────────────────────────────────
create type public.round_status as enum ('pending', 'active', 'ended');

create table if not exists public.competition_rounds (
  id              uuid primary key default uuid_generate_v4(),
  status          public.round_status not null default 'pending',
  started_at      timestamptz,
  ended_at        timestamptz,
  duration_hours  integer not null default 24,
  prize_pool_bnb  numeric(18,8) not null default 0,
  winner_agent_id uuid references public.agents(id),
  created_at      timestamptz not null default now()
);

-- ── LEADERBOARD (materialised view updated by triggers) ───
create table if not exists public.leaderboard (
  agent_id        uuid primary key references public.agents(id),
  round_id        uuid references public.competition_rounds(id),
  total_pnl_bnb   numeric(18,8) not null default 0,
  tokens_created  integer not null default 0,
  trades_executed integer not null default 0,
  rank            integer,
  updated_at      timestamptz not null default now()
);

-- ── AGENT EARNINGS (claimable royalties tracking) ────────
create table if not exists public.agent_earnings (
  id              uuid primary key default uuid_generate_v4(),
  agent_id        uuid not null references public.agents(id),
  token_address   text not null,
  claimable_bnb   numeric(18,8) not null default 0,
  claimed_bnb     numeric(18,8) not null default 0,
  last_claim_tx   text,
  updated_at      timestamptz not null default now()
);

create index on public.agent_earnings(agent_id);

-- ── COPY AGENT FOLLOWS ────────────────────────────────────
create table if not exists public.copy_follows (
  id              uuid primary key default uuid_generate_v4(),
  follower_wallet text not null references public.users(wallet),
  agent_id        uuid not null references public.agents(id),
  stake_bnb       numeric(18,8) not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique(follower_wallet, agent_id)
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────
alter table public.users           enable row level security;
alter table public.agents          enable row level security;
alter table public.meme_tokens     enable row level security;
alter table public.agent_trades    enable row level security;
alter table public.leaderboard     enable row level security;
alter table public.agent_earnings  enable row level security;
alter table public.copy_follows    enable row level security;

-- Public read access for feed and leaderboard
create policy "Public can read meme_tokens"
  on public.meme_tokens for select using (true);

create policy "Public can read leaderboard"
  on public.leaderboard for select using (true);

create policy "Public can read agents"
  on public.agents for select using (true);

-- Service role (used by apps/agent and apps/api) has full access
-- This is automatic in Supabase for service_role key

-- ── REALTIME ──────────────────────────────────────────────
-- Enable realtime on leaderboard and meme_tokens for live UI updates
alter publication supabase_realtime add table public.leaderboard;
alter publication supabase_realtime add table public.meme_tokens;
alter publication supabase_realtime add table public.agent_trades;
