alter table public.players
  add column if not exists total_points integer not null default 0,
  add column if not exists games_played integer not null default 0,
  add column if not exists wins integer not null default 0;

create table if not exists public.matches (
  id uuid primary key,
  room_code varchar(6) not null,
  game_mode text not null,
  locale varchar(8) not null,
  round_count integer not null check (round_count > 0),
  started_at timestamptz not null,
  completed_at timestamptz not null default now()
);

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  display_name varchar(20) not null,
  final_score integer not null,
  final_rank integer not null check (final_rank > 0),
  primary key (match_id, player_id)
);

create index if not exists match_players_player_id_idx
  on public.match_players(player_id);

alter table public.matches enable row level security;
alter table public.match_players enable row level security;

comment on column public.players.total_points is
  'Sum of authoritative final scores from completed matches.';

-- No public policies are intentional. Only the trusted game server writes or
-- reads persistent results through DATABASE_URL.
