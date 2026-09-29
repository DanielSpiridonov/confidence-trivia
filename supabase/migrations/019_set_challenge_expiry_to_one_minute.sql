alter table public.player_challenges
  alter column expires_at set default (now() + interval '1 minute');
