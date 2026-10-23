# Endless implementation and release notes

Implemented locally on 23 October 2026. No remote migration, deployment, push,
EAS build, or production data mutation was performed.

## Behavior

- Home has an Endless action; Create Game also links to the solo lobby.
- The solo lobby follows the supplied chalkboard reference: three larger illustrated
  rule cards, a hand-drawn infinity/title treatment, a generated chalk mountain
  with summit flag, a dark purple play button with independently centered text,
  and best-score, next-milestone and Beat Your Record panels. The small leaderboard
  preview and Unlock Rewards rule were removed. Beat Your Record opens rankings.
  The header reuses the app's existing Stars badge and has no extra trophy button.
  The full Reward Road remains exclusive to run end. Scores are never mock data.
- The menu renders immediately. Home preloads the mountain artwork and fetches
  the account's Endless snapshot; entering the mode displays any cached snapshot
  and refreshes in the background. No menu leaderboard request is made. Initial
  unknown best scores show a dash rather than a fabricated zero. Tapping Play
  during a refresh queues the Start action. Actual run creation and all answers
  still require the authoritative server response; cached state cannot score.
- A fresh state read validates Endless protocol version 2 before Start or old-run
  cleanup is sent. Older server responses and active snapshots without a lease
  show a temporary-unavailability message in the lobby instead of starting an
  unplayable question. API contract/auth failures stop heartbeat retries; network
  interruptions retain the ten-second grace. Try Again always reads fresh state
  and never replays an earlier failed abandonment. A successful fresh read can
  recover as soon as the matching server is deployed.
- A run starts with three lives and zero score. Only correct answers add a
  point. Incorrect/late answers cost one life and reveal the correct choice.
- Questions and answer order are selected on the server. Four answer choices,
  a question token, actual difficulty, duration and deadline reach the client;
  the answer key is withheld until the question has settled.
- Stage progression uses questions encountered: Easy 1–10, Medium 11–25,
  Hard 26–50, Expert 51+. Transitions blend near boundaries. Empty pools fall
  back to the closest available real difficulty. Actual difficulty always sets
  the timer (30/25/20/15 seconds).
- There is no saved-run Continue option. Leaving the mode or backgrounding the
  app sends an immediate abandonment; the whole run ends with zero lives.
  Best scores and earned Stars remain saved. Starting from the lobby closes any
  leftover attempt before creating a fresh one; retries of the same Start stay
  idempotent.
- For connection drops or force-closes that cannot deliver abandonment, the
  server allows at most ten seconds since the last accepted activity. Foreground
  gameplay sends a heartbeat every two seconds without blocking answer taps.
  Reads, repeated Starts and stale tokens never renew this deadline. Reconnecting
  within it keeps the original question timer; at/after it, every action sees a
  finished, abandoned run, including late answers and heartbeats. Expiry is
  persisted on the next request, not dependent on a client goodbye or timer.
  Legacy active snapshots without a connection deadline also end safely.
- Feedback lasts at least 1.6 seconds. A server deadline wins over a late
  submitted answer. Neither client clock nor supplied score affects scoring.
- Questions use a translucent chalkboard question area and separate warm paper
  answer tiles with ink-colored text and a tactile lower edge. There is no
  difficulty-colored outer frame. Hearts remain in the gameplay header.
  Two explicit, fixed-height answer rows reserve space above a separate feedback
  strip, preventing the bottom choices from clipping or overlapping feedback.
  The question panel takes the remaining height and long questions scroll within it.
  Wrong responses explicitly say `Incorrect · −1 life`, mark the player's choice
  red and reveal the right option neutrally with `RIGHT ANSWER`. Timeouts show a
  clock and life-loss message. Only an actually correct response gets a success
  checkmark. The client preserves a full 1.6-second feedback beat after receipt,
  including slow network responses, before advancing or showing run-end progress.
- Answer options react on touch-down, then lock immediately on a completed tap
  with a highlighted selection, dimmed alternatives, sound and haptics. The
  displayed timer freezes while that answer is pending; only the server decides
  correctness/score/deadline validity. Failed requests resume the timer and offer
  reconnection. The ordinary new-best answer transaction uses four SQL statements
  instead of nine, and unchanged retries use two reads without snapshot writes.
  Authentication remains verified against Supabase on every request; network
  latency can still affect when the confirmed result arrives.
- Personal best checkpoints on every verified improvement, including mid-run.
  Reward Road never sums runs or moves backward. Reaching a threshold credits
  Stars automatically, once per account, in the same transaction as the answer.
- Reward Road is shown only after the entire run ends, after the final answer
  feedback. Its own screen fades in, shows the road and earned Stars for three
  seconds, then fades out into the results screen. There are no road screens
  between questions, and no road in the lobby or active gameplay. Backgrounding
  pauses the presentation; reduced-motion settings disable its fades.
- The all-time Endless leaderboard has its own tab, names, equipped avatars,
  top 100, and the current player's position even outside the top 100. Ties use
  earliest achievement, then player UUID. Ranked LP/calculations stay separate.
- Results show correct score, question count, previous/current best, run rewards,
  replay, main menu and the leaderboard. Exhaustion also has a distinct
  completion message instead of repeating content or charging an extra life.

## Configuration and content

Edit `packages/shared/src/config/endless.ts` for timers, feedback delay, the
ten-second connection window, two-second heartbeat interval and the
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
| `GET /endless/state` | Sync; expire lost runs and settle overdue questions without renewing the connection window |
| `POST /endless/action` | `start` with UUID `requestId`; `answer` with `runId`, `token`, `answer` (0–3 or timeout null); `next` with `runId`, `token`; `heartbeat` or `abandon` with `runId` |
| `GET /endless/leaderboard` | All-time top 100 plus current player |

The existing general HTTP rate limiter covers these endpoints. Responses use
`Cache-Control: no-store`. Client-provided score, lives, timestamps and currency
are discarded. Responses do not contain internal database error messages.
State/action payloads include `protocolVersion: 2`. All Endless responses include
`X-Endless-Protocol: 2`, including errors. Public `/health` includes
`endlessProtocolVersion: 2` so the deployed contract can be checked without an
account token. Reloading Expo cannot update the Render server.

`endlessAction` reuses the bounded PostgreSQL pool and locks the player row
before reading/mutating the run. Authorization/moderation is checked again
inside that lock. A partial unique index guarantees one active run per account.
Concurrent devices share that run; stale question/run tokens cannot settle a
different question. Persistent Start UUIDs prevent a retried Start from granting
fresh lives after completion. Abandonment is irreversible and scoped to its run
ID, so a delayed abandonment cannot end a newer attempt.

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
   Ship the matching mobile update with this server change: older clients do
   not send heartbeats. The connection deadline lives in the existing JSON run
   snapshot; no additional SQL migration is needed beyond migration 023.
   Verify the deployed `/health` returns `endlessProtocolVersion: 2` before device
   testing. On 23 October the configured test URL's public health check returned
   a connected database but no protocol marker: the local server update had not
   reached that service. No remote write or deployment was performed to fix it.
3. Point the development app's existing `EXPO_PUBLIC_SERVER_URL` at that server.
   From the repository root run `npm run dev:mobile:client`, then open the
   already-installed compatible development client. No new native dependency
   was introduced for Endless, so an otherwise current client can Fast Refresh.
4. Run the device checks below. Production migration/deployment requires the
   owner's approval; neither has been executed as part of this change.

## Checks executed

- `npm run test:unit --workspace=packages/server`: builds server/shared and runs
  the complete Node suite: **111 passed, 0 failed**. Includes engine, embedded PostgreSQL, mobile layout/presentation/cache/transport and HTTP route
  tests alongside existing auth, scoring, matchmaking, question-bank, rate-limit
  and multiplayer room regression tests.
- `node node_modules/typescript/bin/tsc --noEmit -p packages/mobile/tsconfig.json`.
- From `packages/mobile`: `node ../../node_modules/expo/bin/cli export --platform
  all --output-dir E:/confidence-trivia/.codex-staging/endless-smoke`. Both Android
  and iOS Hermes bundles and their assets export successfully.
- `git diff --check`.

Database tests run the actual migration and service SQL in isolated PGlite
PostgreSQL, with only the postgres.js transport adapted. They cover private
permissions, one active run, connection expiry/abandonment, stale commands,
fresh Starts after expiry, persistence, timeout/retry behavior, concurrent
requests, atomic reward rollback, several milestones, replay/best retention,
leaderboard ties/top-100 behavior and account deletion. PGlite serializes its
single connection: multi-process PostgreSQL lock contention and production load
are not measured by these tests. HTTP tests replace Supabase verification and
storage with controlled fixtures; no live account or remote DB is contacted.
Transport regressions cover older API responses, unsupported heartbeat/abandon,
missing leases, state-only retries, recovery after a server update, auth errors,
offline/abort failures and unchanged compatible state.

Still required before release: real iPhone/Android visual and interaction
playtesting, screen-reader/font-scaling checks, real Supabase/Render integration,
and multi-instance load testing against an isolated PostgreSQL service. Docker
was unavailable in this session. This change has not been certified on devices.

Suggested device pass: start, correct/wrong answers, rapid taps, timeout
while submitting, leave/background (run ends), force-close/reopen (fresh attempt),
network drops shorter/longer than ten seconds without resetting question time,
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
- `packages/server/scripts/endless-presentation.test.mjs`
- `packages/server/scripts/endless-cache.test.mjs`
- `packages/server/scripts/endless-transport.test.mjs`
- `packages/mobile/src/screens/EndlessScreen.tsx`
- `packages/mobile/src/components/RewardRoad.tsx`
- `packages/mobile/src/components/EndlessRunProgress.tsx`
- `packages/mobile/src/components/EndlessLobby.tsx`
- `packages/mobile/src/components/EndlessAnswerOption.tsx`
- `packages/mobile/src/components/endlessPresentation.ts`
- `packages/mobile/src/network/endlessCache.ts`
- `packages/mobile/src/network/endlessTransport.ts`
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
