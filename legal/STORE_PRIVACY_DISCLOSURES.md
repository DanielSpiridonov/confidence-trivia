# Store privacy disclosure worksheet

This worksheet supports—but does not replace—the live App Store Connect App
Privacy and Google Play Data Safety forms. Reconfirm every answer against the
release build and each included third-party SDK.

## Likely disclosed categories for version one

| Store category | Confidence Trivia data | Purpose | Linked |
| --- | --- | --- | --- |
| Contact info: email | Apple/Google sign-in email or Apple relay email | Authentication, account management | Yes |
| User content / other user content | Player name and report description | Multiplayer identity, safety | Yes |
| Identifiers: user ID | Supabase user ID and installation UUID | Account/guest identity, security | Yes |
| Usage data: product interaction | Matches, answers, scores, rewards, social actions | App functionality, fraud prevention | Yes |
| Diagnostics / other | IP address, request counters, limited infrastructure logs | Security, operation | Potentially |

The release does not intentionally track users across other companies' apps or
websites, sell data, serve targeted advertising, access contacts/location/photos,
or collect microphone recordings. Confirm the declarations for Supabase, Render,
Apple Sign In, and Google Sign In rather than describing only first-party code.

## Console URLs

- Privacy Policy: `[PUBLIC SITE URL]/privacy`
- Account deletion: `[PUBLIC SITE URL]/delete-account`
- Support: `[PUBLIC SITE URL]/support`
- Terms: `[PUBLIC SITE URL]/terms`
- Community Rules: `[PUBLIC SITE URL]/community-rules`

## Re-review triggers

Repeat both store questionnaires before enabling advertisements, analytics,
crash-reporting SDKs, real-money purchases, user-uploaded images, or new social
features. Those changes may add data categories, tracking declarations, consent
requirements, and platform-specific disclosures.

