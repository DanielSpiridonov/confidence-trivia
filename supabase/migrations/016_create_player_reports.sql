create table if not exists public.player_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.players(id) on delete set null,
  reported_player_id uuid references public.players(id) on delete set null,
  reported_name text not null,
  description text not null check (char_length(description) between 10 and 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  resolution_note text
);

create index if not exists player_reports_review_queue_idx
  on public.player_reports(status, created_at desc);

create index if not exists player_reports_reporter_recent_idx
  on public.player_reports(reporter_id, reported_player_id, created_at desc);

alter table public.player_reports enable row level security;

-- Reports are written and reviewed only through trusted server/admin tooling.
