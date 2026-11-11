# Confivia bots

Bots use GameRoom's existing answer validation, scoring, Damage combat, visual readiness and phase transitions. No AI service is used. Server-seeded decisions are reproducible; avatar and name never influence skill. Bot names retain the Bot- prefix and have an explicit isBot schema flag.

## Matchmaking and private rooms

Damage (the existing 1v1 queue) offers Play vs Bot in the opponent nameplate after five seconds. Human searching continues until selection. The server checks elapsed time and seats, blocks concurrent admissions while locking, reserves the wager, and starts the same room against a bot. Ranked and accepted friend challenges remain human-only.

Private Classic and Friends hosts can add bots from a phantom row at the end of the lobby roster, choose Easy/Normal/Hard, remove bots before starting and fill duo teams. Bots are automatically ready. Room capacity counts bot seats. Only humans receive host ownership. Bots answer, choose confidence, skip optional side bets and earn normal in-match scores. Timers stop on phase changes, cancellation, completion and disposal. Visual readiness needs acknowledgements only from human clients.

## Economy

Damage bot matches use the selected Star wager. The human's stake is reserved before the countdown. A win pays twice the stake (net profit of one stake), a loss pays nothing, and a draw or cancelled countdown refunds the stake. The house funds the bot's side; no synthetic player accounts are created. Winnings have no additional daily bot cap, per the accepted balancing decision. Difficulty stays fixed by wager tier and never adapts to performance.

Private Classic/Friends bot matches use existing match-completion rewards and progression. Human participants earn 10 completion Stars in their first five rewarded games per UTC day, sharing the same cap with human-only matches. Bot identities are never persisted as players. Forfeiting a bot match grants no completion reward. Ranked stays human-only.

Bot escrow uses bot_damage_wagers and the existing star_transactions ledger. Reserve, debit, payout and refund are transactional and idempotent. Existing human wager tables and transactions are unchanged. Cancellation/disposal refund reserved unfinished games; completed games settle their outcome. Transient settlement errors are retried. A process crash or persistent database outage can leave active escrow requiring reconciliation; room state remains in memory, as in existing human matches.

## Deployment

Apply ONLY supabase/migrations/024_create_bot_damage_wagers.sql once to the selected database before deploying this server revision. It adds a private escrow table and a nullable audit-reference column/index; existing rows are unchanged. Account purge anonymizes retained references under the existing retention policy. The migration has not been applied automatically. If testing shares production's database, test wagers and rewards change real balances.

Deploy matching mobile JavaScript: public room state now identifies bot games with botMatch. The UI explains wagers and rewards instead of practice-only rules.

## Balancing

packages/server/src/bots.ts contains the tunables:

| Skill | Easy question | Medium question | Hard question |
| --- | --- | --- | --- |
| Easy | 75% | 55% | 40% |
| Normal | 85% | 70% | 50% |
| Hard | 95% | 85% | 70% |

Wager tiers: 5/15/40 = Easy; 60/75/100 = Normal; 150/300/500 = Hard. All bot answers are immediate when the question phase starts, after human loading readiness. Confidence decisions: 0.8-3 seconds, with noisy belief and occasional confident mistakes. Incorrect integer guesses remain whole numbers; decimal guesses use at most two decimal places. Known exact answers stay unchanged. Closest-answer accuracy describes exact knowledge; wins still depend on all submissions under existing rules.

## Validation

Run npm.cmd run test:unit --workspace=packages/server and node_modules/.bin/tsc.cmd --noEmit -p packages/mobile/tsconfig.json.

Tests cover configured accuracy, live localized keys, every question type, numeric guesses, deterministic choices, queue races, host permissions, normal scoring, duo teams, visual readiness and cleanup. PostgreSQL tests exercise migration privacy, repeated/concurrent reserves and settlements, insufficient funds, rollback, completion caps and anonymized deletion. PGlite tests do not measure lock contention across real server instances.
