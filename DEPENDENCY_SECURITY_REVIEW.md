# Dependency security review

Last reviewed: 2026-09-10

## Result

`npm audit --omit=dev` was run against the production dependency tree. Safe,
non-breaking fixes reduced the report from 37 findings (12 high, 23 moderate,
2 low) to 31 findings (10 high, 18 moderate, 3 low). There are no critical
findings.

The vulnerable `qs@6.15.3` used by Express, body-parser, and Colyseus OAuth
helpers was replaced with `qs@6.16.0` through the root npm override. This stays
inside the consumers' compatible major version and removes the two published
`qs` advisories from the installed tree.

## Findings requiring a planned major upgrade

### Expo SDK / build tooling

The remaining Metro, PostCSS, image-size, xmldom, xcode, and related Expo
findings are reached through Expo's CLI, bundler, configuration, or native
project generation toolchain. The application does not accept user-provided
CSS, XML, source maps, ICNS, JXL, or HEIF files for these tools to process in
production. npm's offered remediation upgrades Expo SDK 54 to SDK 57, which is
a breaking platform migration and requires new native builds and full iOS and
Android regression testing.

### Colyseus 0.15

The server's remaining nanoid, elliptic, UUID, grant, and Colyseus findings can
only be removed by npm through a breaking Colyseus 0.15 to 0.18 upgrade. The
reported nanoid failure cases require invalid caller-controlled generator sizes;
the game does not expose such a size parameter. The OAuth helper chain bundled
by Colyseus is not used for Confidence Trivia authentication, which is handled
through Supabase. A Colyseus upgrade must nevertheless be completed in a
separate migration and tested across room creation, matchmaking, challenges,
reconnection, wagers, and both mobile clients.

## Release handling

- Do not run `npm audit fix --force` on the release branch.
- Keep dependency installation locked with `package-lock.json`.
- Run `npm audit --omit=dev` again before each release candidate.
- Schedule the Expo SDK and Colyseus migrations independently, with fresh
  development builds and multiplayer regression tests.
- Reassess this review immediately if the app begins processing user-provided
  XML, CSS, source maps, or image files on the server or build service.

