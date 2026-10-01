-- Sign-in access and profile/social data are removed by the existing deletion
-- endpoint immediately. Record the deletion time in the database so this also
-- works with the currently deployed server and with verified support requests.
alter table public.players add column if not exists deleted_at timestamptz;

update public.players set deleted_at = last_seen_at
where account_type = 'deleted' and deleted_at is null;

create or replace function public.record_player_deletion_time()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.account_type = 'deleted' then
    if tg_op = 'INSERT' then
      new.deleted_at := coalesce(new.deleted_at, now());
    elsif old.account_type <> 'deleted' then
      new.deleted_at := now();
    else
      new.deleted_at := old.deleted_at;
    end if;
  else
    new.deleted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists record_player_deletion_time on public.players;
create trigger record_player_deletion_time
before insert or update on public.players
for each row execute function public.record_player_deletion_time();

create index if not exists players_deleted_at_idx on public.players(deleted_at)
where account_type = 'deleted';

-- Remove this player's result/redemption rows on purge. Match summaries and
-- the other participants' results/progression remain intact.
alter table public.match_players drop constraint match_players_player_id_fkey;
alter table public.match_players add constraint match_players_player_id_fkey
foreign key (player_id) references public.players(id) on delete cascade;
alter table public.ranked_match_results drop constraint ranked_match_results_player_id_fkey;
alter table public.ranked_match_results add constraint ranked_match_results_player_id_fkey
foreign key (player_id) references public.players(id) on delete cascade;
alter table public.promo_code_redemptions drop constraint promo_code_redemptions_player_id_fkey;
alter table public.promo_code_redemptions add constraint promo_code_redemptions_player_id_fkey
foreign key (player_id) references public.players(id) on delete cascade;

-- Preserve the currency audit trail without the removed player identifier.
-- In particular, deleting one participant must not destroy the opponent's
-- wager transactions or reset a promo's total redemption count.
alter table public.star_transactions alter column player_id drop not null;
alter table public.star_transactions drop constraint star_transactions_player_id_fkey;
alter table public.star_transactions add constraint star_transactions_player_id_fkey
foreign key (player_id) references public.players(id) on delete set null;

alter table public.damage_wagers
  alter column player_one_id drop not null,
  alter column player_two_id drop not null;
alter table public.damage_wagers
  drop constraint damage_wagers_player_one_id_fkey,
  drop constraint damage_wagers_player_two_id_fkey,
  drop constraint damage_wagers_winner_id_fkey;
alter table public.damage_wagers
  add constraint damage_wagers_player_one_id_fkey
    foreign key (player_one_id) references public.players(id) on delete set null,
  add constraint damage_wagers_player_two_id_fkey
    foreign key (player_two_id) references public.players(id) on delete set null,
  add constraint damage_wagers_winner_id_fkey
    foreign key (winner_id) references public.players(id) on delete set null;

create or replace function public.purge_deleted_accounts()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  deleted_count integer;
begin
  delete from public.players
  where account_type = 'deleted' and auth_user_id is null
    and deleted_at <= now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_deleted_accounts() from public, anon, authenticated;
revoke all on function public.record_player_deletion_time() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;
select cron.schedule(
  'purge-deleted-accounts', '30 3 * * *',
  'select public.purge_deleted_accounts()'
);
