alter table public.players
  add column if not exists stars integer not null default 0;

alter table public.players
  drop constraint if exists players_stars_nonnegative;

alter table public.players
  add constraint players_stars_nonnegative check (stars >= 0);

create table if not exists public.star_transactions (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete restrict,
  amount integer not null check (amount <> 0),
  reason text not null,
  source_match_id uuid references public.matches(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (player_id, reason, source_match_id)
);

create index if not exists star_transactions_player_created_idx
  on public.star_transactions(player_id, created_at desc);

alter table public.star_transactions enable row level security;

comment on column public.players.stars is
  'Persistent spendable currency. This is separate from match score and historical match points.';

comment on table public.star_transactions is
  'Immutable server-authoritative ledger of all earned and spent stars.';

-- No public policies are intentional. Only the trusted game server may
-- award or spend currency through DATABASE_URL.
