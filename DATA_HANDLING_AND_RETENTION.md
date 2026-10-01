# Confivia Data Handling and Retention

This inventory describes the version-one application. It must be reviewed whenever a feature, SDK, analytics service, advertisement provider, or payment system is added.

## Data inventory

| Data | Purpose | Stored by | Shared/transmitted to |
| --- | --- | --- | --- |
| Installation UUID | Support onboarding, account linking, and session restoration | Device secure/local storage; game database | Render game server |
| Player name | Multiplayer identity, friends, rankings and moderation | Game database | Other players where the name is displayed |
| Supabase user ID and provider | Link protected progress to an authenticated account | Supabase Auth; game database | Supabase and Render game server |
| Email address | Authentication and profile display | Supabase Auth | Supabase and authenticated profile endpoint only; never public |
| Stars and immutable star ledger | Currency balance, rewards, fraud prevention and wager settlement | Game database | Authenticated player and Render game server |
| Cosmetics and equipped items | Persistent customization | Game database | Render server and other players when shown in a game |
| Scores, match placement, rank, LP and wins | Gameplay results and persistent progression | Game database | Players in the match and ranked leaderboard where applicable |
| Custom-room questions and expected answers | Run a private host-created match | Active Render room memory only; not intentionally persisted | Players invited to that room |
| Friendships, Blessings and challenges | Social features and reward integrity | Game database | The involved players |
| Presence timestamps | Show whether a friend can be challenged | Game database | Friends through the game server |
| Player reports and moderator decisions | Player safety and enforcement | Game database | Trusted administrators only |
| Promo-code redemptions | Prevent duplicate claims | Game database | Render game server |
| Access tokens | Authenticate protected requests | Device secure storage and transient server requests | Supabase and Render game server; never logged |
| IP address/request counters | Short-term abuse prevention and hosting security | Server memory and infrastructure logs | Render infrastructure |
| Audio/accessibility preferences | Personalized app behavior | Device local storage | Not intentionally transmitted |

The app does not require microphone access and does not intentionally collect contacts, precise location, photos, health information, or advertising identifiers in version one.

## Retention baseline

The following separates implemented behavior from retention targets that still
need configuration or a manual operating procedure.

- Presence records: 30-day inactivity cleanup is a target, not implemented for
  registered players. The guest job removes presence for stale guest records.
- Temporary, unlinked installation records: sweep daily once inactive for 30
  days, provided no match, currency, safety, or social record references them.
  `supabase/migrations/021_cleanup_inactive_guest_installations.sql` installs
  this job. The owner reported applying it on 1 October 2026; its first
  successful execution still needs confirmation in Supabase Cron History.
- Completed/expired challenges and claimed Blessings: 30-day cleanup is a
  target; no scheduled cleanup currently exists in the repository.
- Resolved or dismissed reports: deletion 30 days after resolution is a target;
  no scheduled cleanup currently exists. Pending reports remain until reviewed.
- Completed matches: the server writes `matches` and `match_players` on match
  completion, plus `ranked_match_results` for Ranked. These records currently
  have no automatic expiry. Player names in match results are replaced on
  account deletion; account aggregates and integrity records are retained.
- Application logs: the server writes startup and error messages to standard
  output/error. Production errors contain a context, error name, and optional
  database error code. Render captures these messages and applies its workspace
  plan retention (Hobby: 7 days; Pro: 14 days; Scale/Enterprise: 30 days).
  The production plan and any external log streams have not been inspected.
  Source: https://render.com/docs/logging.
- Custom-room questions and expected answers: discard when the active room ends; do not include them in application logs.
- Registered profile, stars, inventory, friends, rank and aggregate progression: retain while the account exists because they provide the requested persistent service.
- Promo redemption records and star/wager ledger entries: retain while the account exists where necessary to prevent duplicate rewards and preserve currency integrity.
- On account deletion: remove authentication, profile, social and cosmetic data
  immediately. Migration `022_purge_deleted_accounts_after_30_days.sql` records
  `deleted_at` and schedules a daily purge after 30 days. The purge removes the
  player row, its match/Ranked result rows and promo redemption rows; it clears
  player references in retained star transactions and wagers. Other players'
  results, balances, transactions and promo redemption counts are preserved.
  This migration must be applied before publishing this new retention promise.
- For an account linked to Apple, the iOS deletion flow requests fresh Apple
  authorization and the server attempts to revoke it through Apple's REST API
  before deleting the Supabase identity. Failure to contact Apple does not block
  the user's deletion request.

## Access and transport

- Production mobile builds reject a game-server URL that does not use `wss://`; HTTP API calls are derived as `https://`.
- Supabase authentication is considered configured only with an `https://` project URL.
- Health and news are intentionally public. Registered-player stars, cosmetics and reward status require ownership authentication. A high-entropy installation UUID is used temporarily during onboarding and account linking before gameplay.
- Database tables use row-level security without public client policies. Mutations go through the trusted Render server.
- Production error logging records only an error category/name and safe database error code, not raw error objects.

## Operational review

Before store submission, confirm the Render log-retention setting is no more than 30 days and record the selected Supabase and Render hosting regions in the Privacy Policy. Re-run this inventory when advertisements, payments, analytics, crash reporting or new social features are introduced.

The owner reported applying the guest cleanup migration to Supabase on
1 October 2026. Check that the
`cleanup-inactive-guest-installations` Cron job is active and inspect its first
run in Supabase Cron History. Guest rows with integrity or moderation references
are deliberately retained for individual review. This job does not implement
the separate 30-day match, support, or log retention commitments above.
