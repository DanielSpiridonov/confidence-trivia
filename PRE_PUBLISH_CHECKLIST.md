# Confidence Trivia — Final Pre-Publishing Checklist

This is the canonical checklist that must be completed before preparing the
Apple App Store and Google Play submissions. A checked item must be implemented,
tested on the affected platforms, and documented where applicable.

## 1. Account lifecycle

- [x] Implement functional Sign in with Apple on iOS.
- [x] Add an authenticated in-app **Delete Account** action.
- [x] Add a protected backend account-deletion endpoint.
- [x] Define which records are deleted, anonymized, or retained for account deletion.
- [x] Remove or anonymize all personal and social data during deletion.
- [x] Delete the linked Supabase Auth identity safely.
- [ ] Publish a public account-deletion/request page.
- [x] Complete the full account-lifecycle test, including account creation,
      cross-device sign-in, sign-out, session expiry, and deletion.
- [ ] Decide whether account-data export is required for version 1.

## 2. Player safety and moderation

- [ ] Add a **Report player/name** action anywhere public player names appear.
- [x] Add basic offensive-name filtering for permanent account names.
- [ ] Define how reports are reviewed and resolved.
- [ ] Verify blocking removes friend access and prevents new challenges.
- [ ] Add server rate limits for authentication, names, friends, challenges,
      blessings, promo codes, and daily rewards.
- [ ] Add protections against repeated automated requests and reward abuse.

## 3. Privacy and data handling

- [ ] Maintain a verified inventory of collected, transmitted, and stored data.
- [ ] Define retention periods for guests, accounts, matches, ranked history,
      currency ledgers, friendships, challenges, presence, and server logs.
- [ ] Verify that every production API and WebSocket connection uses HTTPS/WSS.
- [ ] Review public endpoints and require authentication wherever data does not
      need to be public.
- [ ] Document Supabase and Render regions, subprocessors, and retention settings.
- [ ] Remove unused Android microphone/audio-recording permissions.
- [ ] Ensure production logs never expose access tokens or unnecessary personal data.

## 4. Legal documents and owner information

- [ ] Confirm the legal developer/data-controller name and jurisdiction.
- [ ] Create public support and privacy email addresses.
- [ ] Decide the minimum player age and intended release regions.
- [ ] Publish an accurate Privacy Policy.
- [ ] Publish Terms of Use.
- [ ] Publish an Account Deletion page.
- [ ] Publish a Support page.
- [ ] Publish community/player-name rules.
- [ ] Explain virtual stars and 1v1 star wagering accurately.
- [ ] Document the final data-retention policy.

## 5. Content ownership

- [ ] Record the source and commercial-use rights for every image and icon.
- [ ] Record licences and source links for every sound effect and music track.
- [ ] Confirm the commercial-use rights for generated avatars and other AI assets.
- [ ] Review questions for copyright-sensitive or externally copied material.
- [ ] Preserve proof of licences and royalty-free claims.
- [ ] Remove unused, temporary, and reference assets from production builds.

## 6. Core product completion

- [ ] Complete the deeper question-variety rewrite; avoid formula-heavy repetition.
- [x] Verify guest progress transfers correctly when an account is linked.
- [x] Verify registered progress restores correctly on another device.
- [ ] Test Ranked matchmaking, placements, LP, and ranked wins with four accounts.
- [ ] Test Friends, Blessings, blocking, and challenges on unstable connections.
- [ ] Decide whether Friends Mode is included in version 1 or remains unavailable.
- [ ] Ensure unavailable/future features cannot be mistaken for working purchases.

## 7. Reliability and security

- [ ] Complete Android and iPhone regression passes.
- [ ] Test representative small, medium, large, notched, and cutout screen sizes.
- [ ] Stress-test concurrent public rooms, private rooms, Damage games, and Ranked queues.
- [ ] Test reconnection, intentional leaving, timeouts, and server restarts.
- [ ] Verify wagers are reserved and settled exactly once.
- [ ] Verify stars, daily rewards, Blessings, and promo codes cannot be duplicated.
- [ ] Add production monitoring and actionable error reporting.
- [ ] Configure and test database backups and restoration.
- [ ] Audit production dependencies and resolve material vulnerabilities.

## 8. Accessibility and user experience

- [ ] Verify text remains readable with accessibility font settings.
- [ ] Add meaningful accessibility labels to icons and image-only buttons.
- [ ] Verify normal and high-contrast readability.
- [ ] Complete the popup, confirmation, and error-consistency pass.
- [ ] Test keyboard dismissal and screen-reader navigation.
- [ ] Confirm safe areas, orientation, and immersive mode on iOS and Android.

## 9. Production configuration

- [ ] Separate production services/data from development and testing where needed.
- [ ] Verify production environment variables without committing secret values.
- [ ] Confirm the final bundle ID, Android package name, app name, and URL scheme.
- [ ] Set the release version and build-number strategy.
- [ ] Validate final app icon, adaptive icon, splash screen, and loading screen.
- [ ] Confirm encryption/export-compliance configuration.
- [ ] Remove development-only configuration from production builds.
- [ ] Ensure bots, test users, test news, and test transactions are absent from production.

## 10. Final release candidate

- [ ] Freeze the version-one feature set.
- [ ] Produce clean iOS and Android release builds.
- [ ] Test distribution through TestFlight and a Google Play testing track.
- [ ] Repeat the complete account-lifecycle test on release builds.
- [ ] Complete a final security, privacy, legal-document, and content-rights review.
- [ ] Resolve every remaining item above before preparing store metadata.

## Explicitly deferred until after version 1

- Rewarded advertisements.
- Real-money star purchases and platform billing.
- Visual/image-question paid mode.
- Avatar combat animations beyond the current implementation.
- Expanded Friends Mode, unless promoted into the version-one scope later.

Deferred features must remain disabled or be labelled clearly as unavailable.
