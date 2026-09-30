create index if not exists player_challenges_challenger_created_idx
  on public.player_challenges (challenger_id, created_at desc);
