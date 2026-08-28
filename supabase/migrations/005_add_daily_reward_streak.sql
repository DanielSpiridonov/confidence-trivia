alter table public.star_transactions
  add column if not exists reward_streak_day smallint;

alter table public.star_transactions
  drop constraint if exists star_transactions_reward_streak_day_check;

alter table public.star_transactions
  add constraint star_transactions_reward_streak_day_check
  check (reward_streak_day is null or reward_streak_day between 1 and 5);

comment on column public.star_transactions.reward_streak_day is
  'Consecutive daily-claim day, capped at 5. Null for non-daily and legacy transactions.';
