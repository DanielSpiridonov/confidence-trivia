# Dependency security review

Last reviewed: 2026-10-24

## Result

`npm audit --omit=dev` was run against the current dependency tree. This pass
reduced the report from 29 findings (2 critical, 13 high, 12 moderate, 2 low)
to 19 findings (0 critical, 6 high, 11 moderate, 2 low). These are npm package
findings, including parent packages affected by a vulnerable dependency; they
are not a count of independently exploitable application flaws.

Compatible updates installed body-parser 1.20.9, proxy-addr 2.0.8, compression
1.8.2, brace-expansion 1.1.21 / 2.1.7 / 5.0.12, fast-uri 3.1.9, shell-quote
1.12.0, source-map-js 1.2.2, and undici 6.29.1. Expo and Colyseus major
versions remain unchanged. Automatic `npm audit fix` attempted an incompatible
Expo resolution and failed; targeted updates were used instead.

The vulnerable `qs@6.15.3` used by Express, body-parser, and Colyseus OAuth
helpers was replaced with `qs@6.16.0` through the root npm override. This stays
inside the consumers' compatible major version and removes the two published
`qs` advisories from the installed tree.

PostCSS is overridden to 8.5.23, retaining its major version while replacing
Expo's narrowly pinned 8.4 release. This addresses the maintainer's
[source-map disclosure advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp)
and the other PostCSS findings in the current audit. Both iOS and Android
Hermes exports passed with this override.

## Remaining dependency findings

### Expo SDK / build tooling

Remaining underlying packages include image-size, node-forge, and UUID through
Expo's build and native project tooling. The application does not run these
build tools on player-uploaded content. This limits the player-facing exposure;
it does not establish that all build workflows are unaffected. The installed
compatible releases still have advisories. Do not accept npm's suggested Expo
44 downgrade as a remediation for this SDK 54 application. Resolve these with
maintainer patches or a separately validated tooling/SDK migration.

### Colyseus 0.15

Remaining underlying packages include nanoid 2, elliptic, and UUID, with
additional affected parent packages in Colyseus's bundled OAuth chain. The
application uses Supabase authentication rather than those OAuth helpers.
Colyseus calls nanoid's v2 default function export; replacing it with v3 via an
override would change that API. npm proposes Colyseus 0.18 as a stack-level
remediation. Validate room creation, matchmaking, challenges, reconnection,
wagers, and both mobile clients before adopting a different Colyseus stack.

## Application fixes in this pass

- Bound and normalize room creation payloads before question generation,
  including round counts, exclusion lists, categories, and custom questions.
- Recheck room admission synchronously after asynchronous authentication;
  canonicalize installation UUIDs to prevent duplicate seats via letter case.
- Reject malformed confidence/side-bet messages and changes after phase
  deadlines. Cancel phase timers when a room is disposed.
- Catch rejected Express 4 route promises and return sanitized JSON errors for
  unexpected failures, invalid JSON, and oversized bodies. Apply the general
  request budget before parsing bodies and before the database health route.
- Limit Supabase and Apple authentication requests to five seconds. Reuse
  verified identity within a single HTTP request.
- Key account action limits by verified user identity. Refreshed tokens retain
  the same budget; arbitrary invalid authorization headers use the IP budget.
- Keep temporary solo Custom testing available, without persisting completion
  Stars, games played, or wins for those practice sessions.

## Remaining application and operational concerns

- The image-reveal public asset manifest still contains descriptive Storage
  filenames. A modified client can infer subjects from those paths, and the
  full image is delivered before the client-side blur is removed. Competitive
  protection requires opaque Storage object names and, if early image access
  must be prevented, server-controlled reveal assets. That migration requires
  coordinated Storage and asset-delivery changes; it was not performed here.
- If the previously committed development tunnel credential has not been
  rotated, rotate it. Ignoring the local configuration does not revoke a
  credential or remove it from Git history. No credentials are reproduced in
  this document.
- Action limits remain process-local. Shared limits are needed before running
  multiple independent server instances if a global account budget is required.

## Validation and limits

164 automated tests pass, including PostgreSQL-backed Endless tests and added
regressions for the application fixes above. Mobile TypeScript checking and
iOS/Android Hermes exports pass. A pattern scan of Git candidate text files
found no matching credentials; private documents and audit scratch output stay
in ignored directories. This is a code and dependency review, not a production
penetration test or a claim that no other vulnerabilities exist.

## Release handling

- Do not run `npm audit fix --force` on the release branch.
- Keep dependency installation locked with `package-lock.json`.
- Run `npm audit --omit=dev` again before each release candidate.
- Schedule the Expo SDK and Colyseus migrations independently, with fresh
  development builds and multiplayer regression tests.
- Reassess this review immediately if the app begins processing user-provided
  XML, CSS, source maps, or image files on the server or build service.

