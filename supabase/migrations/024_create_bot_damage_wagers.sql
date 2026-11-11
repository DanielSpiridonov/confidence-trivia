-- Separate escrow for a human against the house; no synthetic player accounts.
-- Additive: existing human wager tables and production code remain unchanged.
create table if not exists public.bot_damage_wagers (
  match_id uuid primary key,
  -- Match the existing account-deletion policy: retain an anonymized audit.
  player_id uuid references public.players(id) on delete set null,
  stake integer not null check (stake in (5, 15, 40, 60, 75, 100, 150, 300, 500)),
  bot_skill text not null check (bot_skill in ('easy', 'normal', 'hard')),
  status text not null default 'active' check (status in ('active', 'paid', 'lost', 'refunded')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

alter table public.star_transactions
  add column if not exists source_bot_wager_id uuid references public.bot_damage_wagers(match_id) on delete restrict;

create unique index if not exists star_transactions_bot_wager_reason_idx
  on public.star_transactions(player_id, reason, source_bot_wager_id)
  where source_bot_wager_id is not null;

alter table public.bot_damage_wagers enable row level security;
revoke all on public.bot_damage_wagers from anon, authenticated;

comment on table public.bot_damage_wagers is
  'Server-only bot Damage escrow: human stakes once; a win pays twice the stake, a loss pays zero, a draw/cancellation refunds.';
