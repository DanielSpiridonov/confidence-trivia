alter table public.player_challenges
  add column if not exists damage_wager integer not null default 5;

alter table public.player_challenges
  drop constraint if exists player_challenges_damage_wager_check;

alter table public.player_challenges
  add constraint player_challenges_damage_wager_check
  check (damage_wager in (5, 15, 40, 60, 75, 100, 150, 300, 500));
