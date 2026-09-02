alter table public.players
  add column if not exists account_type text not null default 'guest',
  add column if not exists auth_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists auth_provider text,
  add column if not exists linked_at timestamptz,
  add column if not exists normalized_display_name text;

alter table public.players
  drop constraint if exists players_account_type_valid;

alter table public.players
  add constraint players_account_type_valid check (account_type in ('guest', 'registered'));

create unique index if not exists players_auth_user_unique_idx
  on public.players(auth_user_id)
  where auth_user_id is not null;

create unique index if not exists players_registered_name_unique_idx
  on public.players(normalized_display_name)
  where account_type = 'registered' and normalized_display_name is not null;

comment on column public.players.auth_user_id is
  'Supabase Auth identity linked to this persistent player. Null for guests.';

comment on column public.players.normalized_display_name is
  'Case-insensitive uniqueness key reserved only for permanent registered names.';
