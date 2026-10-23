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
- [ ] Check both landscape rotations: the notch margin belongs only on its actual side; content should use the remaining width without the old 720-unit frame.
- [ ] Confirm Daily Reward, Leaderboard and Shop sit against the left safe edge, and the burger menu sits at the bottom-right safe edge.
- [ ] Open the burger menu and tap all four entries; confirm none are clipped or outside the interactive dock.
- [ ] Open Create Game and confirm the mode list uses roughly one third of the width and the configuration column has room for its controls.
- [ ] Verify Home, Endless and multiplayer question screens on a narrow and a wide iPhone; this change updates their shared iOS canvas sizing.
- [ ] In Endless, confirm A/B and C/D stay fully visible above the feedback strip. Check short and long questions, a pending answer, incorrect feedback and a timeout; question text may scroll, but answer rows must not move or overlap the feedback.
- [ ] Leave Endless during a question or feedback, then return: the old run must end and the lobby must offer a fresh attempt. Best score and earned Stars must remain.
- [ ] Background Endless, including while Start is pending: returning must show an ended run or a fresh lobby, never an indefinitely saved question.
- [ ] Keep the app foregrounded and disconnect the network briefly: reconnect before the ten-second server window closes and confirm the original question timer keeps running. Reconnect after ten seconds and confirm the entire run ends, including when disconnected during feedback.
- [ ] Force-close/reopen Endless and confirm there is no Continue button. Start a new run, then verify a delayed old answer/abandonment cannot affect it.
- [ ] Verify the configured test server's `/health` reports `endlessProtocolVersion: 2`. An older server must show mode unavailability before Start, not an unplayable question or repeated Invalid Endless Action errors. After updating the server, Try Again must recover with a fresh read.
- [ ] Confirm game background and preloaded avatar/shop images appear without flashes.
- [ ] Confirm music, sound effects, countdown cancellation, and volume settings work.
- [ ] Confirm game-start/end vibration works and does not trigger per round.
- [ ] Confirm leaving a game stops countdown audio and returns menu music correctly.
- [ ] Confirm deep-linking back from authentication does not leave a white overlay or stale browser screen.

## Deferred Apple authentication

- [ ] Configure Apple Sign In only when the Apple Developer setup is ready.
- [ ] Add the Apple provider back to the Profile UI.
- [ ] Verify Apple sign-in, account linking, session persistence, sign-out, and returning-account recovery.
