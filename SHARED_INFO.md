# Confivia Shared Project Info

Last updated: 29 September 2026

Read this file first when starting work in a new chat. It is the concise project
handoff. For detailed rules, use `concept.txt`; for the authoritative release
checklist, use `PRE_PUBLISH_CHECKLIST.md`.

## Working rules

- The repository may contain uncommitted user work. Never revert unrelated
  changes, deleted files, new assets, or configuration without explicit approval.
- Check `git status --short` before editing and work with existing changes.
- Keep internal identifiers stable when changing visible branding or labels.
- The current display name is **Confivia**. Older internal names such as
  `confidence-trivia` remain intentionally where changing them would affect
  storage, package identifiers, URL schemes, or infrastructure.
- English is the only launch language. Other languages are shown as Coming Soon.
- Version one requires a connected Apple or Google account before gameplay.
  There is no playable guest-account mode. A temporary installation UUID is used
  only for onboarding, account linking, and session restoration.

## Product and stack

- Landscape mobile game for iPhone and Android, built with Expo/React Native and
  TypeScript.
- Real-time authoritative multiplayer uses Colyseus on the server.
- Accounts and persistent data use Supabase Auth and PostgreSQL.
- The game server is deployed on Render. Production deploys from `main`; normal
  development work currently happens on `master`.
- Public legal pages are hosted on Daniel's Vercel portfolio.
- Core modes currently include Classic, Custom, Ranked, and 1v1 Damage.
- Persistent systems include accounts, stars, daily rewards/streaks, cosmetics,
  friends, Blessings, challenges, notifications, reports, Ranked LP, and public
  or private rooms.
- Real-money star purchases, rewarded ads, and platform billing are disabled for
  version one.

## Current state

- The complete game loop has been playtested on Android and iPhone.
- Startup/account gate, profile, shop, daily rewards, Custom mode, Ranked
  prototype, Damage mode, friends, notifications, and legal pages exist.
- Mobile version is set to `1.0.0`.
- Production URLs must use HTTPS/WSS and production Supabase/Render values. Never
  commit secrets or rely on `.env.local` for release builds.
- The startup menu includes Community and Legal external links with a confirmation
  before leaving the app.
- Recent UI work includes the shared confirmation redesign, persistent shop tabs
  to prevent iPhone star-icon loading flashes, the closed angled Rules book icon,
  and an interactive Custom-mode scrollbar.

## Active worktree task

The News feature is being changed into an **Inbox** with two categories:

- Challenges: list pending challenges and allow accept/decline.
- News: display published news and mark it read only when this tab is viewed.

The working tree currently contains `InboxScreen.tsx`, changes in `App.tsx` and
`HomeScreen.tsx`, and deletion of `NewsScreen.tsx`. Treat this as active work
until it is compiled and tested on both platforms. Do not restore `NewsScreen.tsx`
unless the Inbox implementation is deliberately reverted.

The working tree also contains a logo-asset replacement (`emblem-logo.png` with
older startup emblem files removed). Preserve it and verify all references before
building.

## Public links

- Privacy: https://daniel-portfolio-pied.vercel.app/projects/confivia/privacy
- Terms: https://daniel-portfolio-pied.vercel.app/projects/confivia/terms
- Account deletion: https://daniel-portfolio-pied.vercel.app/projects/confivia/delete-account
- Community rules: https://daniel-portfolio-pied.vercel.app/projects/confivia/community-rules
- Support: https://daniel-portfolio-pied.vercel.app/projects/confivia/support
- Discord: https://discord.gg/BjcjJGSyxv

## Before-launch TODO

### Immediate product work

- [ ] Finish and verify the Inbox conversion, including challenge counts,
  accept/decline behavior, expiry, news read state, and burger-menu totals.
- [ ] Confirm the new logo asset loads immediately in clean iOS and Android
  release builds with no missing old asset references.
- [ ] Freeze the version-one feature set after the current minor fixes.

### Legal and data

- [ ] Replace the remaining legal placeholders with the public postal/contact
  address and final launch/effective date.
- [ ] Verify all five public legal URLs load without authentication and match the
  repository drafts.
- [ ] Add Sign in with Apple token revocation to account deletion, or complete
  the documented compliant fallback before App Store submission.
- [ ] Implement/configure the retention behavior claimed by the Privacy Policy,
  including 30-day cleanup and infrastructure log retention, or revise the
  policy so it exactly matches production.
- [ ] Document the final Supabase and Render regions, subprocessors, transfer
  safeguards, backup retention, and log settings.
- [ ] Decide how account access/export requests will be handled for version one;
  an authenticated or verified support process is acceptable if documented.
- [ ] Clean production data before launch: remove bots, test users, test news,
  test transactions, and other development records.
- [ ] Obtain a final legal review after production behavior and dates are final.

### Content ownership

- [ ] Record sources, licences, and commercial-use rights for every image, icon,
  sound effect, music track, generated avatar, and other generated asset.
- [ ] Review the question bank for copied or copyright-sensitive material and
  preserve evidence for permitted sources.
- [ ] Remove unused, temporary, and reference assets from the production bundle.

### Testing and reliability

- [ ] Test Ranked matchmaking, placements, LP, ties, abandonment, and wins with
  four real accounts.
- [ ] Test Friends, Blessings, blocking, and challenges on unstable connections.
- [ ] Run Android and iPhone regression passes across small, large, notched, and
  cutout devices.
- [ ] Stress-test concurrent public/private rooms, Custom, Damage, and Ranked.
- [ ] Test reconnects, intentional leaving, timeouts, app background/resume,
  sleeping behavior, and Render/server restarts.
- [ ] Complete the remaining accessibility pass: labels, font scaling, contrast,
  keyboard dismissal, screen-reader navigation, safe areas, and immersive mode.
- [ ] Configure production monitoring, actionable error reporting, database
  backups, and a tested restoration procedure.

### Release candidate

- [ ] Confirm release builds contain only production `wss://`/`https://` URLs,
  production Supabase values, and no localhost or development credentials.
- [ ] Validate the final app icon, adaptive icon, splash/loading screen, package
  identifiers, URL scheme, version, and build numbers.
- [ ] Produce clean iOS and Android release builds.
- [ ] Test through TestFlight and a Google Play testing track.
- [ ] Repeat account creation, cross-device restore, sign-out, session expiry,
  account deletion, and re-registration using release builds.
- [ ] Complete final security, privacy, legal, content-rights, and store-disclosure
  reviews before submission.

## High-priority after launch

- Create a separate test Render service and test database. Keep production on
  `main`; a test service may deploy from `master`.
- Harden Ranked seasons, abandonment/reconnect handling, boosting protection,
  duplicate-account detection, and LP audit visibility.
- Complete the deeper question-variety rewrite and expand the reviewed question
  catalogue.
- Complete full localization only after native-speaker review.
- Expand Custom/Friends with team and social options.
- Consider rewarded ads, real-money star packs, and store billing only with full
  Apple/Google billing plus server-side receipt validation.
- Add visual question packs and richer avatar combat animations later.

## Reference files

- `concept.txt`: full gameplay concept and historical decisions. Some early
  sections are outdated; explicit later decisions and this file take precedence.
- `PRE_PUBLISH_CHECKLIST.md`: canonical detailed launch checklist.
- `DATA_HANDLING_AND_RETENTION.md`: production data inventory and retention plan.
- `DEPENDENCY_SECURITY_REVIEW.md`: dependency/security audit notes.
- `MODERATION_POLICY.md`: player report and moderation process.
- `PROMO_AND_NEWS_ADMIN.md`: administrative news and promo procedures.
- `legal/`: public policy drafts and store disclosure worksheet.
