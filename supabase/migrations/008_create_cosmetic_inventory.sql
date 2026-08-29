create table if not exists public.player_cosmetics (
  player_id uuid not null references public.players(id) on delete cascade,
  cosmetic_id text not null,
  cosmetic_type text not null,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  equipped_at timestamptz,
  primary key (player_id, cosmetic_id)
);

create unique index if not exists player_cosmetics_one_equipped_per_type_idx
  on public.player_cosmetics(player_id, cosmetic_type)
  where equipped;

create index if not exists player_cosmetics_player_idx
  on public.player_cosmetics(player_id, acquired_at);

alter table public.player_cosmetics enable row level security;

comment on table public.player_cosmetics is
  'Server-managed cosmetic inventory and equipped state. Name colors are free during prototype testing.';
