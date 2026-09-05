# To Be Tested on iPhone

Use this checklist after an Apple Developer team is available and an iOS development or TestFlight build can be installed. Expo Go is not sufficient for OAuth/deep-link testing.

## Build and authentication

- [ ] Install an iOS development build signed by the Apple Developer team.
- [ ] Confirm `confidence-trivia://auth/callback` returns from Safari to the game.
- [ ] Sign in with Google and confirm the Profile screen shows the correct email and provider.
- [ ] Fully close and reopen the app; confirm the Google session remains active.
- [ ] Confirm the linked player ID, stars, cosmetics, wins, games, rank, and LP are restored.
- [ ] Sign out and confirm the device returns to a fresh guest identity without altering registered progress.
- [ ] Sign back into the same Google account and confirm the original registered progress returns.
- [ ] Test an expired/revoked session and confirm the app safely returns to guest mode with a clear message.
- [ ] Confirm SecureStore session persistence works across app restarts and iPhone reboots.

## Profile and identity rules

- [ ] Change the permanent player name from Profile and confirm it persists after restart.
- [ ] Confirm a duplicate permanent name shows the server rejection.
- [ ] Confirm invalid/special-character names cannot be submitted.
- [ ] Confirm Bulgarian/Cyrillic names are accepted.
- [ ] Confirm Create Game and Join Game show the assigned name as read-only.
- [ ] Confirm guests cannot reach Shop through Shop, Inventory, or the stars balance.
- [ ] Confirm guests cannot enter Ranked.

## Ranked matchmaking

- [ ] Select Ranked and confirm the action says **Join Queue** rather than **Create Room**.
- [ ] Confirm the waiting screen shows **Searching for ranked players** and the correct `1/4–4/4` count.
- [ ] Confirm Ranked exposes no room code, visibility control, Ready button, or manual Start button.
- [ ] Queue four authenticated devices and confirm the match locks and starts automatically.
- [ ] Confirm Ranked queues never appear in the public Join Game browser.
- [ ] Cancel at `1/4`, `2/4`, and `3/4`; confirm the remaining queue stays open and the departing seat is freed.
- [ ] Background and restore the app while queued; confirm the connection recovers or exits cleanly.
- [ ] Disconnect one player during a Ranked match and confirm the match/placement rules behave as designed.
- [ ] Complete placement matches and confirm LP, rank, wins, and leaderboard update correctly.

## iOS regression checks after installing the development build

- [ ] Confirm landscape orientation, safe-area padding, and keyboard dismissal remain correct.
- [ ] Confirm game background and preloaded avatar/shop images appear without flashes.
- [ ] Confirm music, sound effects, countdown cancellation, and volume settings work.
- [ ] Confirm game-start/end vibration works and does not trigger per round.
- [ ] Confirm leaving a game stops countdown audio and returns menu music correctly.
- [ ] Confirm deep-linking back from authentication does not leave a white overlay or stale browser screen.

## Deferred Apple authentication

- [ ] Configure Apple Sign In only when the Apple Developer setup is ready.
- [ ] Add the Apple provider back to the Profile UI.
- [ ] Verify Apple sign-in, account linking, session persistence, sign-out, and returning-account recovery.
