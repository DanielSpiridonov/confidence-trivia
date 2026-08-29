create table if not exists public.damage_wagers (
  match_id uuid primary key,
  player_one_id uuid not null references public.players(id) on delete restrict,
  player_two_id uuid not null references public.players(id) on delete restrict,
  stake integer not null check (stake in (5, 15, 40, 60, 75, 100, 150, 300, 500)),
  status text not null default 'active' check (status in ('active', 'paid', 'refunded')),
  winner_id uuid references public.players(id) on delete restrict,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

alter table public.star_transactions
  add column if not exists source_wager_id uuid references public.damage_wagers(match_id) on delete restrict;

create unique index if not exists star_transactions_wager_reason_idx
  on public.star_transactions(player_id, reason, source_wager_id)
  where source_wager_id is not null;

alter table public.damage_wagers enable row level security;

comment on table public.damage_wagers is
  'Server-authoritative escrow and settlement record for Damage-mode star wagers.';
