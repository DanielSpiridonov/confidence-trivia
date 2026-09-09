# Promo codes and news administration

Run `supabase/migrations/014_create_promo_codes_and_news.sql` once before deploying the matching server build.

Create a promo code in the Supabase SQL editor:

```sql
insert into public.promo_codes (code, star_reward, expires_at, max_redemptions)
values ('WELCOME100', 100, '2026-12-31 23:59:59+00', 1000);
```

`expires_at` and `max_redemptions` may be `null`. Codes must use uppercase letters, numbers, `_`, or `-` and be 3–32 characters long. Redemption is limited to once per registered player and recorded in the star transaction ledger.

Publish localized news posts separately so each language receives the correct copy:

```sql
insert into public.news_posts (locale, title, body)
values
  ('en', 'Welcome!', 'The News screen is now live.'),
  ('bg', 'Добре дошли!', 'Екранът с новини вече е активен.');
```

Set `active = false` to hide a code or news post without deleting its history.
