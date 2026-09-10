alter table public.players
  add column if not exists last_name_changed_at timestamptz;

comment on column public.players.last_name_changed_at is
  'Time of the latest manual free name change. Null means the first change is still available.';
