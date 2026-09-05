alter table public.players
  add column if not exists ranked_wins integer not null default 0;

-- Preserve wins from ranked matches already recorded before this column existed.
update public.players player
set ranked_wins = coalesce((
  select count(*)::integer
  from public.ranked_match_results result
  where result.player_id = player.id
    and result.placement = 1
), 0);

alter table public.players
  drop constraint if exists players_ranked_wins_nonnegative;

alter table public.players
  add constraint players_ranked_wins_nonnegative check (ranked_wins >= 0);

drop index if exists public.players_ranked_leaderboard_idx;

create index players_ranked_leaderboard_idx
  on public.players(ranked_lp desc, ranked_wins desc, created_at asc);

comment on column public.players.ranked_wins is
  'First-place finishes in ranked matches only. General wins remain in players.wins.';
