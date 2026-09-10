alter table public.players
  add column if not exists moderation_status text not null default 'active',
  add column if not exists suspended_until timestamptz,
  add column if not exists moderation_note text;

alter table public.players drop constraint if exists players_moderation_status_valid;
alter table public.players add constraint players_moderation_status_valid
  check (moderation_status in ('active', 'rename_required', 'suspended', 'banned'));

create index if not exists players_moderation_status_idx
  on public.players(moderation_status, suspended_until);

comment on column public.players.moderation_note is
  'Private moderator note. Never expose this value through public APIs.';
