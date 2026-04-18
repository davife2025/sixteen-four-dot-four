-- ============================================================
-- SIXTEEN — Supabase Migration 004
-- Platform config table + initial seed data
-- Run: supabase db push
-- ============================================================

-- ── PLATFORM CONFIG ───────────────────────────────────────
-- Single-row config table for platform-wide settings
-- Updated by admin, read by all apps

create table if not exists public.platform_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.platform_config enable row level security;
create policy "Public can read config"
  on public.platform_config for select using (true);

-- ── SEED: Default platform config ─────────────────────────
insert into public.platform_config (key, value) values
  ('network',              '"bscTestnet"'),
  ('chainId',              '97'),
  ('virality_threshold',   '60'),
  ('max_tokens_per_round', '3'),
  ('max_bnb_per_cycle',    '0.5'),
  ('copy_fee_bps',         '150'),
  ('agent_cycle_mins',     '2'),
  ('round_duration_hours', '24'),
  ('fourmeme_contract',    '"0x5c952063c7fc8610FFDB798152D69F0B9550762b"'),
  ('kimi_model',           '"moonshotai/Kimi-K2-Instruct-0905"'),
  ('kimi_endpoint',        '"https://router.huggingface.co/v1"')
on conflict (key) do nothing;

-- ── AGENT LOGS TABLE ──────────────────────────────────────
-- Structured logs per agent action for debugging
-- Shows every decision Kimi K2 made and why

create table if not exists public.agent_logs (
  id          uuid primary key default uuid_generate_v4(),
  agent_id    uuid not null references public.agents(id),
  action      text not null,     -- 'create', 'buy', 'sell', 'skip', 'error'
  token_address text,
  reasoning   text,              -- Kimi K2's reasoning
  virality_score integer,
  amount_bnb  numeric(18,8),
  outcome     text,              -- 'success' | 'failed' | 'skipped'
  created_at  timestamptz not null default now()
);

create index on public.agent_logs(agent_id);
create index on public.agent_logs(created_at desc);

alter table public.agent_logs enable row level security;
create policy "Public can read agent_logs"
  on public.agent_logs for select using (true);

-- Enable realtime on logs for live activity feed
alter publication supabase_realtime add table public.agent_logs;

-- ── NOTIFICATIONS TABLE ───────────────────────────────────
-- Push notifications for owners when their agent acts

create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  owner_wallet text not null,
  type        text not null,     -- 'token_launched' | 'trade_executed' | 'profit_sent' | 'round_won'
  title       text not null,
  body        text not null,
  read        boolean not null default false,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index on public.notifications(owner_wallet);
create index on public.notifications(read, created_at desc);

alter table public.notifications enable row level security;
create policy "Public can read notifications"
  on public.notifications for select using (true);

alter publication supabase_realtime add table public.notifications;
