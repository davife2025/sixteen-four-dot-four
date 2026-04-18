-- ============================================================
-- SIXTEEN — Supabase Migration 002
-- Prediction market + copy-agent enhancements
-- Run: supabase db push
-- ============================================================

-- ── PREDICTION MARKET ─────────────────────────────────────
-- Users bet BNB on which agent will win a round
-- Smart contract holds funds; this table mirrors the bets

create table if not exists public.predictions (
  id              uuid primary key default uuid_generate_v4(),
  round_id        uuid not null references public.competition_rounds(id),
  bettor_wallet   text not null,
  agent_id        uuid not null references public.agents(id),
  stake_bnb       numeric(18,8) not null,
  tx_hash         text not null,
  settled         boolean not null default false,
  payout_bnb      numeric(18,8),
  payout_tx_hash  text,
  created_at      timestamptz not null default now()
);

create index on public.predictions(round_id);
create index on public.predictions(bettor_wallet);
create index on public.predictions(agent_id);

alter table public.predictions enable row level security;
create policy "Public can read predictions"
  on public.predictions for select using (true);

-- ── SIXTEEN SCORE UPDATE FUNCTION ─────────────────────────
-- Recomputes sixteen_score whenever bonding_curve_pct or
-- virality_score changes on a meme_token

create or replace function public.compute_sixteen_score()
returns trigger as $$
begin
  -- Formula:
  --   50% virality_score (pre-launch quality)
  --   30% bonding curve progress (market demand)
  --   20% bonus if video asset type
  new.sixteen_score :=
    (new.virality_score * 0.5)
    + (new.bonding_curve_pct * 0.3)
    + (case when new.asset_type = 'video' then 20 else 0 end);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sixteen_score on public.meme_tokens;
create trigger trg_sixteen_score
  before insert or update of virality_score, bonding_curve_pct, asset_type
  on public.meme_tokens
  for each row execute function public.compute_sixteen_score();

-- ── LEADERBOARD AUTO-UPDATE FUNCTION ──────────────────────
-- Updates leaderboard totals when a trade P&L is recorded

create or replace function public.update_leaderboard_on_trade()
returns trigger as $$
begin
  if new.pnl_bnb is not null then
    insert into public.leaderboard (agent_id, round_id, total_pnl_bnb, tokens_created, trades_executed)
    values (new.agent_id, new.round_id, new.pnl_bnb, 0, 1)
    on conflict (agent_id) do update set
      total_pnl_bnb   = leaderboard.total_pnl_bnb + excluded.total_pnl_bnb,
      trades_executed = leaderboard.trades_executed + 1,
      updated_at      = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leaderboard_trade on public.agent_trades;
create trigger trg_leaderboard_trade
  after insert or update of pnl_bnb
  on public.agent_trades
  for each row execute function public.update_leaderboard_on_trade();

-- ── TOKEN PHASE AUTO-TRANSITION ───────────────────────────
-- Moves a token from 'insider' to 'public' once the
-- insider window closes (simplified: after 10 mins or 5% fill)

create or replace function public.auto_transition_phase()
returns trigger as $$
begin
  if new.phase = 'insider' and new.bonding_curve_pct >= 5 then
    new.phase := 'public';
  end if;
  if new.bonding_curve_pct >= 100 then
    new.phase := 'graduated';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_phase_transition on public.meme_tokens;
create trigger trg_phase_transition
  before update of bonding_curve_pct
  on public.meme_tokens
  for each row execute function public.auto_transition_phase();

-- Enable realtime on predictions table
alter publication supabase_realtime add table public.predictions;
alter publication supabase_realtime add table public.copy_follows;
