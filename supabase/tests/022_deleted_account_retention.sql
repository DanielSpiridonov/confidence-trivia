-- Run against a test database after applying migration 022. All changes roll
-- back, including any older deleted-account rows swept by the cleanup function.
begin;
do $$
declare
  old_player uuid := gen_random_uuid();
  recent_player uuid := gen_random_uuid();
  active_player uuid := gen_random_uuid();
  guest_player uuid := gen_random_uuid();
  test_match_id uuid := gen_random_uuid();
  own_transaction uuid := gen_random_uuid();
  other_transaction uuid := gen_random_uuid();
  test_promo_id uuid := gen_random_uuid();
begin
  insert into public.players(id, display_name, account_type, deleted_at)
  values
    (old_player, 'Deleted User', 'deleted', now() - interval '31 days'),
    (recent_player, 'Deleted User', 'deleted', now() - interval '29 days'),
    (active_player, 'Retention Test', 'registered', null),
    (guest_player, 'Guest', 'guest', null);
  update public.players set stars = 42, ranked_lp = 20 where id = active_player;

  -- Subsequent activity updates must not restart the deletion clock.
  update public.players set last_seen_at = now() where id = old_player;

  insert into public.matches(id, room_code, game_mode, locale, round_count, started_at)
  values(test_match_id, 'RETENT', 'ranked', 'en', 1, now());
  insert into public.match_players(match_id, player_id, display_name, final_score, final_rank)
  values(test_match_id, old_player, 'Deleted User', 1, 2),
    (test_match_id, active_player, 'Retention Test', 2, 1);
  insert into public.ranked_match_results(match_id, player_id, placement,
    was_placement_match, lp_before, lp_delta, lp_after)
  values(test_match_id, old_player, 2, false, 10, 0, 10),
    (test_match_id, active_player, 1, false, 10, 10, 20);
  insert into public.damage_wagers(match_id, player_one_id, player_two_id,
    stake, status, winner_id, settled_at)
  values(test_match_id, old_player, active_player, 5, 'paid', old_player, now());
  insert into public.star_transactions(id, player_id, amount, reason, source_wager_id)
  values(own_transaction, old_player, 10, 'retention_test', test_match_id),
    (other_transaction, active_player, -5, 'retention_test', test_match_id);
  insert into public.promo_codes(id, code, star_reward, redemption_count)
  values(test_promo_id, upper(test_promo_id::text), 5, 2);
  insert into public.promo_code_redemptions(promo_code_id, player_id)
  values(test_promo_id, old_player), (test_promo_id, active_player);

  perform public.purge_deleted_accounts();
  if exists(select 1 from public.players where id = old_player) then
    raise exception 'Old deleted player was not purged';
  end if;
  if (select count(*) from public.players where id in
      (recent_player, active_player, guest_player)) <> 3 then
    raise exception 'Recent, registered, or guest player was incorrectly purged';
  end if;
  if exists(select 1 from public.match_players where player_id = old_player)
    or exists(select 1 from public.ranked_match_results where player_id = old_player) then
    raise exception 'Deleted player results were retained';
  end if;
  if not exists(select 1 from public.match_players
      where match_id = test_match_id and player_id = active_player) then
    raise exception 'Opponent results were removed';
  end if;
  if not exists(select 1 from public.players
      where id = active_player and stars = 42 and ranked_lp = 20)
    or not exists(select 1 from public.ranked_match_results
      where match_id = test_match_id and player_id = active_player) then
    raise exception 'Opponent balance or Ranked progression was changed';
  end if;
  if exists(select 1 from public.promo_code_redemptions where player_id = old_player)
    or not exists(select 1 from public.promo_codes
      where id = test_promo_id and redemption_count = 2)
    or not exists(select 1 from public.promo_code_redemptions
      where promo_code_id = test_promo_id and player_id = active_player) then
    raise exception 'Promo records were not safely removed/preserved';
  end if;
  if not exists(select 1 from public.star_transactions
      where id = own_transaction and player_id is null)
    or not exists(select 1 from public.star_transactions
      where id = other_transaction and player_id = active_player) then
    raise exception 'Currency history was not safely detached/preserved';
  end if;
  if not exists(select 1 from public.damage_wagers wager
      where wager.match_id = test_match_id and player_one_id is null
        and winner_id is null and player_two_id = active_player) then
    raise exception 'Wager player references were not safely detached';
  end if;

  update public.players set account_type = 'deleted', auth_user_id = null
  where id = active_player;
  if not exists(select 1 from public.players
      where id = active_player and deleted_at = now()) then
    raise exception 'New deletion did not record its timestamp';
  end if;
end;
$$;
rollback;
