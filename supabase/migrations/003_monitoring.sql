-- ============================================================
-- SIXTEEN — Supabase Migration 003
-- Agent error logging + health monitoring table
-- Run: supabase db push
-- ============================================================

-- ── AGENT ERROR LOG ───────────────────────────────────────

create table if not exists public.agent_errors (
  id          uuid primary key default uuid_generate_v4(),
  agent_id    uuid not null references public.agents(id),
  error_type  text not null,
  message     text not null,
  context     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index on public.agent_errors(agent_id);
create index on public.agent_errors(created_at desc);

alter table public.agent_errors enable row level security;
-- Only service role can read errors (private monitoring)

-- ── AGENT HEALTH LOG ──────────────────────────────────────

create table if not exists public.agent_health (
  id          uuid primary key default uuid_generate_v4(),
  kimi_k2     boolean not null default false,
  supabase    boolean not null default false,
  bnb_rpc     boolean not null default false,
  checked_at  timestamptz not null default now()
);

-- Only keep last 100 health records
create or replace function public.trim_health_log()
returns trigger as $$
begin
  delete from public.agent_health
  where id not in (
    select id from public.agent_health
    order by checked_at desc
    limit 100
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_trim_health on public.agent_health;
create trigger trg_trim_health
  after insert on public.agent_health
  execute function public.trim_health_log();

alter table public.agent_health enable row level security;
