alter table public.star_transactions
  add column if not exists reward_day date;

create unique index if not exists star_transactions_daily_claim_idx
  on public.star_transactions (player_id, reason, reward_day)
  where reason = 'daily_claim';

comment on column public.star_transactions.reward_day is
  'UTC calendar day used to make daily rewards idempotent.';
