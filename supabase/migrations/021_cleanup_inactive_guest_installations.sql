-- A guest row is a temporary installation identity used before account linking.
-- Registered accounts and deleted-account tombstones must never be swept here.
-- A guest with gameplay, currency, moderation, or social references is skipped
-- so this job cannot silently remove records needed for integrity or review.
create or replace function public.cleanup_inactive_guest_installations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  -- Presence is transient and must not keep an abandoned installation alive.
  delete from public.player_presence presence
  using public.players player
  where presence.player_id = player.id
    and player.account_type = 'guest'
    and player.auth_user_id is null
    and player.last_seen_at < now() - interval '30 days';

  delete from public.players player
  where player.account_type = 'guest'
    and player.auth_user_id is null
    and player.last_seen_at < now() - interval '30 days'
    and not exists (select 1 from public.match_players ref where ref.player_id = player.id)
    and not exists (select 1 from public.ranked_match_results ref where ref.player_id = player.id)
    and not exists (select 1 from public.star_transactions ref where ref.player_id = player.id)
    and not exists (select 1 from public.damage_wagers ref where player.id in (ref.player_one_id, ref.player_two_id, ref.winner_id))
    and not exists (select 1 from public.promo_code_redemptions ref where ref.player_id = player.id)
    and not exists (select 1 from public.player_reports ref where player.id in (ref.reporter_id, ref.reported_player_id))
    and not exists (select 1 from public.friendships ref where player.id in (ref.player_low_id, ref.player_high_id, ref.requested_by, ref.blocked_by))
    and not exists (select 1 from public.friend_gifts ref where player.id in (ref.sender_id, ref.receiver_id))
    and not exists (select 1 from public.player_challenges ref where player.id in (ref.challenger_id, ref.challenged_id));

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_inactive_guest_installations() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'cleanup-inactive-guest-installations',
  '15 3 * * *',
  'select public.cleanup_inactive_guest_installations()'
);
