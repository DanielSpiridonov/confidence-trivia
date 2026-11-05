# News administration

Promo-code redemption has been removed from the mobile app and server. Existing
promo-code tables and redemption records remain for historical accounting and
account-retention cleanup; creating codes no longer enables rewards.

Version one is English-only. Publish launch news with the `en` locale:

```sql
insert into public.news_posts (locale, title, body)
values ('en', 'Welcome!', 'The News screen is now live.');
```

When another language becomes available, publish a separately reviewed post
for that locale rather than relying on automatic translation.

Set `active = false` to hide a news post without deleting its history.
