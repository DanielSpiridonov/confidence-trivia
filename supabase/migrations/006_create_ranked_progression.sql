alter table public.players
  add column if not exists ranked_lp integer not null default 0,
  add column if not exists ranked_placement_matches integer not null default 0,
  add column if not exists ranked_placement_points integer not null default 0;

alter table public.players
  drop constraint if exists players_ranked_lp_nonnegative,
  drop constraint if exists players_ranked_placement_matches_range,
  drop constraint if exists players_ranked_placement_points_range;

alter table public.players
  add constraint players_ranked_lp_nonnegative check (ranked_lp >= 0),
  add constraint players_ranked_placement_matches_range check (ranked_placement_matches between 0 and 3),
  add constraint players_ranked_placement_points_range check (ranked_placement_points between 0 and 9);

create table if not exists public.ranked_match_results (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  placement integer not null check (placement between 1 and 4),
  was_placement_match boolean not null,
  placement_points_awarded integer not null default 0,
  lp_before integer not null check (lp_before >= 0),
  lp_delta integer not null,
  lp_after integer not null check (lp_after >= 0),
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists players_ranked_leaderboard_idx
  on public.players(ranked_lp desc, wins desc, created_at asc);

create index if not exists ranked_match_results_player_idx
  on public.ranked_match_results(player_id, created_at desc);

alter table public.ranked_match_results enable row level security;

comment on column public.players.ranked_lp is
  'Server-authoritative ranked LP. Zero while a player is still Novice unless their placement rank is Bronze III.';

comment on table public.ranked_match_results is
  'Idempotent match-linked audit history for placements, placement progress, and LP changes.';

-- No public policies are intentional. Ranked state is read and written only
-- through the trusted game server.
