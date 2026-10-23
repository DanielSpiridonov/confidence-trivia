-- Only the trusted Render server connects directly. Answer keys and active runs
-- must never be readable/writable through the public Supabase API.
create table public.endless_records (
  player_id uuid primary key references public.players(id) on delete cascade,
  best_score integer not null default 0 check (best_score >= 0),
  achieved_at timestamptz not null default clock_timestamp()
);
create index endless_leaderboard_idx on public.endless_records(best_score desc, achieved_at, player_id);

create table public.endless_runs (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  state jsonb not null,
  finished boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index endless_one_active_run_idx on public.endless_runs(player_id) where not finished;
create index endless_latest_run_idx on public.endless_runs(player_id, finished, created_at desc, id);

create table public.endless_reward_claims (
  player_id uuid not null references public.players(id) on delete cascade,
  milestone integer not null check (milestone > 0),
  stars integer not null check (stars > 0),
  run_id uuid references public.endless_runs(id) on delete set null,
  transaction_id uuid not null unique references public.star_transactions(id),
  claimed_at timestamptz not null default clock_timestamp(),
  primary key (player_id, milestone)
);

alter table public.endless_records enable row level security;
alter table public.endless_runs enable row level security;
alter table public.endless_reward_claims enable row level security;
revoke all on public.endless_records, public.endless_runs, public.endless_reward_claims from public, anon, authenticated;
comment on table public.endless_reward_claims is 'Once per account milestones, credited atomically with the existing Star ledger. Server only.';

-- Remove private run history immediately when the existing deletion endpoint
-- anonymizes an account. The currency ledger follows the existing retention policy.
create function public.erase_deleted_endless_data() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.account_type = 'deleted' and old.account_type <> 'deleted' then
    delete from public.endless_reward_claims where player_id = new.id;
    delete from public.endless_runs where player_id = new.id;
    delete from public.endless_records where player_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.erase_deleted_endless_data() from public, anon, authenticated;
create trigger erase_deleted_endless_data after update of account_type on public.players
for each row execute function public.erase_deleted_endless_data();
