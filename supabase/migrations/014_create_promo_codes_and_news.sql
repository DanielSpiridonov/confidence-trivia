create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  star_reward integer not null check (star_reward > 0),
  active boolean not null default true,
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  created_at timestamptz not null default now(),
  constraint promo_codes_uppercase check (code = upper(code))
);

create table if not exists public.promo_code_redemptions (
  promo_code_id uuid not null references public.promo_codes(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  redeemed_at timestamptz not null default now(),
  primary key (promo_code_id, player_id)
);

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  locale text not null default 'en' check (locale in ('en', 'bg')),
  published_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists news_posts_active_published_idx on public.news_posts(locale, active, published_at desc);

alter table public.promo_codes enable row level security;
alter table public.promo_code_redemptions enable row level security;
alter table public.news_posts enable row level security;

-- These tables are managed through the trusted game server. No public policies.
