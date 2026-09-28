# Store privacy disclosure worksheet

This internal worksheet supports—but does not replace—the live App Store
Connect App Privacy and Google Play Data Safety forms. Reconfirm every answer
against the exact release build, backend configuration, server logs, and every
included or transitively bundled SDK immediately before submission.

## Verified product position for version one

- Minimum user age: 16.
- No third-party advertising or advertising analytics.
- No cross-app tracking.
- No real-money purchases.
- No intentional collection of contacts, precise location, photos, health
  information, microphone recordings, or advertising identifiers.
- Supabase provides authentication and database services.
- Render hosts the game server.
- Apple and Google sign-in are available for account authentication.

Do not submit this section as final until each statement has been confirmed in
the production build.

## Proposed Apple App Privacy mapping

| Apple data type | Confivia example | Linked to user | Purpose |
| --- | --- | --- | --- |
| Contact Info — Email Address | Apple/Google sign-in email or Apple relay email | Yes | App functionality; account management |
| User Content — Other User Content | Player name, Custom-room questions and answers, and information voluntarily sent in support or safety reports | Yes | App functionality; customer support; safety |
| Identifiers — User ID | Supabase user ID and temporary installation identifier | Yes | App functionality; authentication; security |
| Usage Data — Product Interaction | Answers, matches, scores, rewards, wagers, progression, friendships, Blessings, challenges, and presence interactions | Yes | App functionality; fraud prevention |
| Diagnostics — Other Diagnostic Data | Connection events, request counters, and limited operational logs, if retained | Usually yes | App functionality; security; diagnostics |

Proposed tracking answer: **No**. Confirm that no SDK combines Confivia data
with third-party data for advertising, advertising measurement, or data-broker
purposes.

## Proposed Google Play Data Safety mapping

| Google category | Confivia example | Collected | Required or optional | Purpose |
| --- | --- | --- | --- | --- |
| Personal info — Email address | Apple/Google sign-in email or Apple relay email | Yes | Required for account connection | Account management; app functionality |
| Personal info — User IDs | Supabase user ID, temporary installation identifier, and player name | Yes | Required for the corresponding account | App functionality; security |
| App activity — App interactions | Answers, matches, scores, progression, rewards, wagers, friendships, Blessings, challenges, and presence interactions | Yes | Required for the corresponding online features | App functionality; fraud prevention |
| App info and performance — Diagnostics | Connection events and limited operational logs, if retained | Verify | Required if collected | App functionality; security; diagnostics |
| Other user-generated content | Custom-room questions and answers, plus information voluntarily included in support or safety requests | Yes when submitted | Required for Custom rooms; otherwise optional | App functionality; customer support; safety |

Data is encrypted in transit only if production traffic exclusively uses HTTPS
and WSS with valid certificates. Mark **Yes** only after verifying the release
configuration.

Supabase and Render receive data as service providers. For Google Play's
**data shared** answers, verify whether each transfer qualifies for Google's
service-provider exception rather than assuming that every processor transfer
must be declared as sharing.

## Account deletion

The final form may state that deletion is available only after all of the
following work in production:

- registered users can start deletion inside Confivia;
- the public web route accepts a deletion request;
- the backend deletes associated personal data rather than merely disabling the
  account; and
- retained exceptions are limited, disclosed, and justified.

Public deletion URL: `https://daniel-portfolio-pied.vercel.app/projects/confivia/delete-account`

## Console URLs

- Privacy Policy: `https://daniel-portfolio-pied.vercel.app/projects/confivia/privacy`
- Account deletion: `https://daniel-portfolio-pied.vercel.app/projects/confivia/delete-account`
- Support: `https://daniel-portfolio-pied.vercel.app/projects/confivia/support`
- Terms: `https://daniel-portfolio-pied.vercel.app/projects/confivia/terms`
- Community Rules: `https://daniel-portfolio-pied.vercel.app/projects/confivia/community-rules`

## Re-review triggers

Repeat both store questionnaires before adding advertisements, analytics,
crash-reporting SDKs, real-money purchases, user-uploaded media, messaging,
push notifications, or new social features. Also
repeat the review whenever Supabase, Render, authentication, logging, or another
SDK or processor changes.
