create table if not exists public.player_presence (
  player_id uuid primary key references public.players(id) on delete cascade,
  available boolean not null default true,
  last_seen_at timestamptz not null default now()
);

create table if not exists public.player_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.players(id) on delete cascade,
  challenged_id uuid not null references public.players(id) on delete cascade,
  game_mode text not null default 'damage',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 seconds'),
  responded_at timestamptz,
  constraint player_challenges_distinct_players check (challenger_id <> challenged_id),
  constraint player_challenges_mode_check check (game_mode = 'damage'),
  constraint player_challenges_status_check check (status in ('pending', 'accepted', 'declined', 'expired'))
);

create index if not exists player_challenges_recipient_idx on public.player_challenges(challenged_id, status, expires_at);
create index if not exists player_challenges_challenger_idx on public.player_challenges(challenger_id, status, expires_at);

alter table public.player_presence enable row level security;
alter table public.player_challenges enable row level security;

-- No public policies. Presence and challenges are controlled by the authenticated server.
