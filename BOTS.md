# Confivia bots

Bots use the existing GameRoom, answer validation, scoring, Damage combat, visual readiness and phase transitions. No AI service is used. A server-only seeded generator makes each round reproducible; avatar and name never influence skill. Bot names retain the `Bot-` prefix, with an explicit `isBot` schema flag.

## Matchmaking and private rooms

Damage (the existing 1v1 queue) exposes an optional Play vs Bot action after five seconds. Human searching continues until selection. The server checks elapsed time and seat count, blocks concurrent admissions while locking, and starts the same room against a bot. Ranked and accepted friend challenges retain human-only matchmaking.

Private Classic and Friends hosts can add Easy, Normal or Hard bots, remove them before starting, and fill duo teams. Bots are ready automatically. Room capacity includes bot seats. Only humans receive host ownership. Bots answer, choose confidence, skip optional side bets and earn normal in-match scores. Their timers are cleared on phase changes, cancellation, completion and disposal. Visual readiness requires acknowledgements only from human clients.

## Economy

Any room that has added a bot remains practice-only for its lifetime, even if the bot is removed. Bot matches never reserve or settle wagers, grant completion Stars, record wins or update progression. The selected Damage wager determines skill but no Stars are staked; the pot is zero. Lobby and results explain this. Human-only matches retain existing transactions. This deliberately conservative policy prevents unlimited farming without introducing a new currency ledger or daily allowance.

## Balancing

`packages/server/src/bots.ts` contains the tunables:

| Skill | Easy question | Medium question | Hard question |
| --- | --- | --- | --- |
| Easy | 70% | 50% | 30% |
| Normal | 85% | 70% | 50% |
| Hard | 95% | 85% | 70% |

Damage wager tiers: 5/15/40 = Easy; 60/75/100 = Normal; 150/300/500 = Hard. Skill is fixed at creation and never adapts to player performance. Response times are 2.5–13 seconds; confidence takes 0.8–3 seconds with noisy belief and occasional confident mistakes. Closest-answer percentages describe exact knowledge; actual wins still depend on other submissions under existing closest-answer rules.

Validation: `npm.cmd run test:unit --workspace=packages/server` and `node_modules/.bin/tsc.cmd --noEmit -p packages/mobile/tsconfig.json`. Bot tests cover accuracy, all question types and live localized answer keys, deterministic decisions, queue races, host permissions, currency isolation, normal scoring, duo teams, visual readiness and timer cleanup.
