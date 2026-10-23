# Endless implementation and release notes

Implemented locally on 23 October 2026. No remote migration, deployment, push,
EAS build, or production data mutation was performed.

## Behavior

- Home has an Endless action; Create Game also links to the solo lobby.
- A run starts with three lives and zero score. Only correct answers add a
  point. Incorrect/late answers cost one life and reveal the correct choice.
- Questions and answer order are selected on the server. Four answer choices,
  a question token, actual difficulty, duration and deadline reach the client;
  the answer key is withheld until the question has settled.
- Stage progression uses questions encountered: Easy 1–10, Medium 11–25,
  Hard 26–50, Expert 51+. Transitions blend near boundaries. Empty pools fall
  back to the closest available real difficulty. Actual difficulty always sets
  the timer (30/25/20/15 seconds).
- An active run persists across device/app/server restarts. Returning to the
  lobby offers Resume. Leaving/backgrounding does not reset the current timer.
  Reconnecting after expiry settles that question once, then waits in feedback;
  further questions do not start automatically while the app is backgrounded.
- Feedback lasts at least 1.6 seconds. A server deadline wins over a late
  submitted answer. Neither client clock nor supplied score affects scoring.
- Personal best checkpoints on every verified improvement, including mid-run.
  Reward Road never sums runs or moves backward. Reaching a threshold credits
  Stars automatically, once per account, in the same transaction as the answer.
- The all-time Endless leaderboard has its own tab, names, equipped avatars,
  top 100, and the current player's position even outside the top 100. Ties use
  earliest achievement, then player UUID. Ranked LP/calculations stay separate.
- Results show correct score, question count, previous/current best, run rewards,
  the road, replay, main menu and the leaderboard. Exhaustion also has a distinct
  completion message instead of repeating content or charging an extra life.

## Configuration and content

Edit `packages/shared/src/config/endless.ts` for timers, feedback delay and the
finite milestone list. It currently awards **280 Stars total** across thresholds
10, 25, 50, 75, 100, 150, 200, 250 and 300. Keep thresholds stable: their number
is the permanent claim identity. Changing an amount does not re-award a claim.
New milestones below an existing best are awarded on the next state request.

The current pool has **156 unique questions**: 30 Easy, 28 Medium, 26 Hard and
72 Expert. It reuses four-option questions and converts existing numeric facts
to four options without changing their answer or difficulty. Expert is an
original math pool with explicit reasoning rubrics and computed answer keys.
The multiplayer question bank and its three-tier types are unchanged.

Content limitations: Expert is math-focused; inherited labels have no empirical
player calibration. A run can currently score at most 156 before exhausting the
bank, so the 200–300 rewards are configured for future content expansion. Add
reviewed, diverse content with stable unique IDs before promoting very long
runs. The selector never silently repeats questions or invents difficulty for
records missing metadata.

## Backend and permissions

All routes require a verified Supabase Bearer token and ownership of an eligible
registered player, supplied as the `playerId` query parameter:

| Route | Operation |
| --- | --- |
| `GET /endless/state` | Resume/sync; settle an expired current question |
| `POST /endless/action` | `start` with UUID `requestId`; `answer` with `runId`, `token`, `answer` (0–3 or timeout null); `next` with `runId`, `token` |
| `GET /endless/leaderboard` | All-time top 100 plus current player |

The existing general HTTP rate limiter covers these endpoints. Responses use
`Cache-Control: no-store`. Client-provided score, lives, timestamps and currency
are discarded. Responses do not contain internal database error messages.

`endlessAction` reuses the bounded PostgreSQL pool and locks the player row
before reading/mutating the run. Authorization/moderation is checked again
inside that lock. A partial unique index guarantees one active run per account.
Concurrent devices share that run; stale question/run tokens cannot settle a
different question. Persistent Start UUIDs prevent a retried Start from granting
fresh lives after completion. There is no active-run reset/abandon endpoint.

Run state, best score/time, milestone claims, existing Star ledger entries and
Star balance updates commit or roll back together. Claims have a primary key on
`(player_id, milestone)` and a unique ledger transaction ID. No public Supabase
table grants or RLS policies expose the three new tables. Deletion follows the
existing account deletion flow through a new database trigger.

## Deployment order

1. Review/apply `supabase/migrations/023_create_endless.sql` to an isolated test
   Supabase project after migrations 001–022. This creates three tables, indexes,
   permissions and an account-deletion trigger; it does not rewrite existing
   Ranked or multiplayer tables/data.
2. Deploy the updated Render server to the matching test environment using its
   existing `DATABASE_URL`, `SUPABASE_URL`, and Supabase publishable key. There
   are no new runtime secrets. `@electric-sql/pglite` is test-only and omitted
   from the production runtime image.
3. Point the development app's existing `EXPO_PUBLIC_SERVER_URL` at that server.
   From the repository root run `npm run dev:mobile:client`, then open the
   already-installed compatible development client. No new native dependency
   was introduced for Endless, so an otherwise current client can Fast Refresh.
4. Run the device checks below. Production migration/deployment requires the
   owner's approval; neither has been executed as part of this change.

## Checks executed

- `npm run test:unit --workspace=packages/server`: builds server/shared and runs
  the complete Node suite: **68 passed, 0 failed**. Includes engine, embedded PostgreSQL and HTTP route
  tests alongside existing auth, scoring, matchmaking, question-bank, rate-limit
  and multiplayer room regression tests.
- `node node_modules/typescript/bin/tsc --noEmit -p packages/mobile/tsconfig.json`.
- From `packages/mobile`: `node ../../node_modules/expo/bin/cli export --platform
  all --output-dir E:/confidence-trivia/.codex-staging/endless-smoke`. Both Android
  and iOS Hermes bundles and their assets export successfully.
- `git diff --check`.

Database tests run the actual migration and service SQL in isolated PGlite
PostgreSQL, with only the postgres.js transport adapted. They cover private
permissions, one active run, persistence, timeout/retry behavior, concurrent
requests, atomic reward rollback, several milestones, replay/best retention,
leaderboard ties/top-100 behavior and account deletion. PGlite serializes its
single connection: multi-process PostgreSQL lock contention and production load
are not measured by these tests. HTTP tests replace Supabase verification and
storage with controlled fixtures; no live account or remote DB is contacted.

Still required before release: real iPhone/Android visual and interaction
playtesting, screen-reader/font-scaling checks, real Supabase/Render integration,
and multi-instance load testing against an isolated PostgreSQL service. Docker
was unavailable in this session. This change has not been certified on devices.

Suggested device pass: start/resume, correct/wrong answers, rapid taps, timeout
while submitting, background past deadline, force-close/reopen, unstable network,
two devices on one account, all three lives lost, replay, beat/fall below a best,
milestone animation/credit, leaderboard tabs, and existing multiplayer modes.

## Source file inventory

Created:

- `packages/shared/src/config/endless.ts`
- `packages/server/src/content/endlessQuestions.ts`
- `packages/server/src/endlessEngine.ts`
- `packages/server/src/endless.ts`
- `packages/server/src/endlessRoutes.ts`
- `packages/server/scripts/endless.test.mjs`
- `packages/server/scripts/endless-database.test.mjs`
- `packages/server/scripts/endless-routes.test.mjs`
- `packages/mobile/src/screens/EndlessScreen.tsx`
- `packages/mobile/src/components/RewardRoad.tsx`
- `packages/mobile/src/components/EndlessLeaderboardPanel.tsx`
- `supabase/migrations/023_create_endless.sql`
- `ENDLESS_MODE.md`

Modified:

- `packages/shared/src/index.ts`
- `packages/server/src/database.ts`, `packages/server/src/index.ts`
- `packages/server/package.json`, `package-lock.json`
- `packages/mobile/App.tsx`, `packages/mobile/src/network/client.ts`
- `packages/mobile/src/screens/HomeScreen.tsx`, `CreateGameScreen.tsx`, `RankedScreen.tsx`
- `.gitignore`, `SHARED_INFO.md`, `DATA_HANDLING_AND_RETENTION.md`, `CONTENT_RIGHTS_LEDGER.md`

Tracked `packages/server/dist` and `packages/shared/dist` outputs were regenerated
by the build. Local smoke exports and npm test cache are ignored. Pre-existing
app configuration, Lobby, translations, plugins and MatchmakingQueue work was
preserved.
