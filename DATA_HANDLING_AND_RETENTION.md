# Confidence Trivia Data Handling and Retention

This inventory describes the version-one application. It must be reviewed whenever a feature, SDK, analytics service, advertisement provider, or payment system is added.

## Data inventory

| Data | Purpose | Stored by | Shared/transmitted to |
| --- | --- | --- | --- |
| Installation UUID | Identify guest progress and reconnect game state | Device secure/local storage; game database | Render game server |
| Player name | Multiplayer identity, friends, rankings and moderation | Game database | Other players where the name is displayed |
| Supabase user ID and provider | Link protected progress to an authenticated account | Supabase Auth; game database | Supabase and Render game server |
| Email address | Authentication and profile display | Supabase Auth | Supabase and authenticated profile endpoint only; never public |
| Stars and immutable star ledger | Currency balance, rewards, fraud prevention and wager settlement | Game database | Authenticated player and Render game server |
| Cosmetics and equipped items | Persistent customization | Game database | Render server and other players when shown in a game |
| Scores, match placement, rank, LP and wins | Gameplay results and persistent progression | Game database | Players in the match and ranked leaderboard where applicable |
| Friendships, Blessings and challenges | Social features and reward integrity | Game database | The involved players |
| Presence timestamps | Show whether a friend can be challenged | Game database | Friends through the game server |
| Player reports and moderator decisions | Player safety and enforcement | Game database | Trusted administrators only |
| Promo-code redemptions | Prevent duplicate claims | Game database | Render game server |
| Access tokens | Authenticate protected requests | Device secure storage and transient server requests | Supabase and Render game server; never logged |
| IP address/request counters | Short-term abuse prevention and hosting security | Server memory and infrastructure logs | Render infrastructure |
| Language and audio/accessibility preferences | Localized and personalized app behavior | Device local storage | Not intentionally transmitted |

The app does not require microphone access and does not intentionally collect contacts, precise location, photos, health information, or advertising identifiers in version one.

## Retention baseline

The default operational retention target is 30 days unless persistent account functionality or security integrity requires a longer period.

- Inactive guest records with no retained match, currency, wager or moderation dependency: delete after 30 days.
- Presence records: delete after 30 days of inactivity.
- Completed/expired challenges and claimed Blessings: delete after 30 days.
- Resolved or dismissed reports and their descriptions: delete 30 days after resolution. Pending reports remain until reviewed.
- Detailed ordinary match records: retain for 30 days. Keep only the account aggregates required for progression afterward.
- Application logs: retain for no more than 30 days and never intentionally log tokens, email addresses or report descriptions.
- Registered profile, stars, inventory, friends, rank and aggregate progression: retain while the account exists because they provide the requested persistent service.
- Promo redemption records and star/wager ledger entries: retain while the account exists where necessary to prevent duplicate rewards and preserve currency integrity.
- On account deletion: remove authentication, profile, social and cosmetic data immediately; retain only anonymized integrity/history records as documented in the deletion flow.

## Access and transport

- Production mobile builds reject a game-server URL that does not use `wss://`; HTTP API calls are derived as `https://`.
- Supabase authentication is considered configured only with an `https://` project URL.
- Health and news are intentionally public. Registered-player stars, cosmetics and reward status require ownership authentication. Guest access uses a high-entropy installation UUID until registration.
- Database tables use row-level security without public client policies. Mutations go through the trusted Render server.
- Production error logging records only an error category/name and safe database error code, not raw error objects.

## Operational review

Before store submission, confirm the Render log-retention setting is no more than 30 days and record the selected Supabase and Render hosting regions in the Privacy Policy. Re-run this inventory when advertisements, payments, analytics, crash reporting or new social features are introduced.
