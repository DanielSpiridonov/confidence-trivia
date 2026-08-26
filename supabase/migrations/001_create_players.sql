create table if not exists public.players (
  id uuid primary key,
  display_name varchar(20) not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.players is
  'Anonymous game installations. IDs are generated and retained on each device.';

alter table public.players enable row level security;

-- No public policies are intentional: mobile clients cannot access this table.
-- The trusted game server connects as the database user and owns all writes.
