alter table public.players
  drop constraint if exists players_account_type_valid;

alter table public.players
  add constraint players_account_type_valid
  check (account_type in ('guest', 'registered', 'deleted'));

alter table public.players
  drop constraint if exists players_auth_user_id_fkey;

alter table public.players
  add constraint players_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;

comment on column public.players.account_type is
  'guest, registered, or an anonymized deleted-account tombstone retained for historical integrity.';
