create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  player_low_id uuid not null references public.players(id) on delete cascade,
  player_high_id uuid not null references public.players(id) on delete cascade,
  requested_by uuid not null references public.players(id) on delete cascade,
  status text not null default 'pending',
  blocked_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_distinct_players check (player_low_id <> player_high_id),
  constraint friendships_canonical_order check (player_low_id::text < player_high_id::text),
  constraint friendships_requester_is_member check (requested_by in (player_low_id, player_high_id)),
  constraint friendships_blocker_is_member check (blocked_by is null or blocked_by in (player_low_id, player_high_id)),
  constraint friendships_status_valid check (status in ('pending', 'accepted', 'blocked')),
  unique (player_low_id, player_high_id)
);

create index if not exists friendships_low_status_idx on public.friendships(player_low_id, status);
create index if not exists friendships_high_status_idx on public.friendships(player_high_id, status);

create table if not exists public.friend_gifts (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null references public.friendships(id) on delete cascade,
  sender_id uuid not null references public.players(id) on delete cascade,
  receiver_id uuid not null references public.players(id) on delete cascade,
  gift_date date not null default (now() at time zone 'utc')::date,
  stars integer not null default 2,
  sent_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint friend_gifts_distinct_players check (sender_id <> receiver_id),
  constraint friend_gifts_reward_fixed check (stars = 2),
  unique (sender_id, receiver_id, gift_date)
);

create index if not exists friend_gifts_receiver_unclaimed_idx
  on public.friend_gifts(receiver_id, gift_date, claimed_at);

alter table public.friendships enable row level security;
alter table public.friend_gifts enable row level security;

-- No public policies: all friendship and currency mutations go through the
-- authenticated authoritative game server.
