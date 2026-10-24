# Map Shapes and Image Reveal

Implemented locally on 23 October 2026. No deployment, production database
change, or new native dependency was made.

## Behavior and scoring

Presentation is optional metadata on the existing question record. Answer types
remain `multiple_choice`, `word`, or `estimate` (exact numeric), and existing
questions without presentation metadata keep their normal renderer and scoring.
Closest Answer is not used for image counts.

Map Shapes shows a fitted country or continent silhouette. Country identifiers
use ISO alpha-2 codes in a country namespace; continent codes have their own
namespace. Multipart island outlines and rings are retained. A local
equirectangular projection uses one uniform scale for both projected axes; SVG
`xMidYMid meet` preserves aspect ratio. Difficulty notes are editorial judgments
about recognition and input method, not empirical player calibrations.

Image Reveal divides the original question duration into exact thirds. The first
stage uses blur 12, the second blur 5, and the third is clear. Transitions crossfade
over 240 ms with native opacity animation; Reduce Motion removes the animation.
Only one artwork layer remains after each transition. Answer feedback shows the
clear image. The same artwork manifest is bundled for every participant; there
are no runtime third-party image URLs. Photos/bitmaps use the bundled source
catalog and native image blur; vector artwork uses SVG Gaussian blur. Bitmap
readiness waits for the actual native image `onLoad` plus layout/paint frames;
`onError` requests the same safe fallback as a missing asset.

| Mode | Correct Image Reveal answer | Incorrect answer |
| --- | --- | --- |
| Classic, Ranked, Custom/Friends | Stage 3/2/1 replaces the normal difficulty base; the existing confidence table, streak rules and side bets still apply | Existing confidence penalty, without a stage bonus |
| 1v1 Damage | Stage 3/2/1 is base damage before the existing carry pot and shield rules | Existing no-damage rule |
| Endless | Always exactly +1, at every stage | One life, including timeouts |

At confidence 1, a correct reveal answer earns exactly 3, 2, or 1 points.
Higher confidence keeps its existing additive adjustment and risk. No confidence
remains a true zero-point opt-out. Damage keeps its mutual-correct draw/pot rule;
earlier answers do not override a draw. Map Shapes uses ordinary difficulty and
mode scoring.

Endless retains the user's latest timers: **20/20/15/15 seconds** for
Easy/Medium/Hard/Expert. These supersede the older timer numbers in the task
attachment. Multiplayer retains its existing 30-second question duration.

## Synchronization, readiness, and failures

Multiplayer publishes metadata in `visual_loading`, then waits for an artwork
layout acknowledgement from every connected player. The visual itself stays
hidden during preparation. A shared server start timestamp begins the timer and
reveal. Missing acknowledgement or a failed asset within eight seconds replaces
the question with a nonvisual question, preserving the round index and scores.
Disconnecting players no longer block readiness. Reconnecting players use the
current synced start/duration and server clock, without restarting the reveal.

Readiness uses the existing Colyseus connection. No second real-time service is
introduced. Stage scoring uses server receipt timestamps only. Client stage,
points, and timestamps are ignored; duplicate and stale-question submissions
cannot change an accepted answer. Existing early-completion countdowns can
shorten the phase, but never change the original reveal-stage boundaries.
Written/numeric multiplayer drafts keep the established timeout submission
behavior; their settlement timestamp determines their reveal base.

Endless has a `loading` phase and authenticated `ready`/`visualFailed` actions.
The question timer starts only after readiness. Its eight-second preparation
deadline prevents indefinite waiting; failed preparation skips the asset and
uses a nonvisual question without losing a life or increasing question number.
Skipped IDs and answer keys stay private. Existing ten-second connection expiry,
abandonment, player ownership checks and atomic milestone transactions remain.

Question/catalog validation rejects unknown assets before server startup.
The mobile missing-asset path also requests a safe fallback for a mismatched
bundle. SVG layout/blur still requires device verification on both platforms.

## Initial content and rights

Eleven authored questions were added: six countries, two continents, and three
Image Reveal questions. The multiplayer bank now has 170 questions; Endless has
167 (34 Easy, 32 Medium, 29 Hard, 72 Expert). Expert currently retains its
existing mathematics content.

Countries: Italy, Australia, Japan, Chile, Madagascar, New Zealand. Continents:
Africa and South America. Prompts cover choice and written input, with curated
alternatives such as Nippon/Nihon and Aotearoa. Geography normalizes case,
diacritics and punctuation against explicit names only, with no fuzzy matching.
Other written answers keep their previous punctuation-sensitive semantics.

Map source: Natural Earth admin-0, 1:110m GeoJSON, downloaded from the
[maintainer's repository](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson).
Natural Earth dedicates its data to the
[public domain](https://www.naturalearthdata.com/about/terms-of-use/).
Source SHA256:
`6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`.
Generalization is intentional: these are small-screen silhouettes, not detailed
border or territorial claims. Continent paths come from the source's continent
grouping, including represented offshore islands; French Guiana is also included
in South America even though the source assigns France as a whole to Europe.

The three Image Reveal illustrations are original code-drawn SVG paths: a
stylized Giza scene (Egypt), an owl, and six apples of which four are red. There
is no external image licensing claim, photo scraping, or generated object count.
The illustrations were exported from those original SVG paths to the three
600x440 PNGs in `packages/mobile/assets/visual/`; the SVG source exports are kept
alongside them. Bundled PNG/JPEG photos can be registered in the same image
catalog after source/license review. No arbitrary URL input is accepted.
English is the launch language; the new BG records intentionally use
the same English content until localization is reviewed.

## Adding questions

For uploaded Supabase photos, use the reviewed Storage importer documented in
`IMAGE_REVEAL_STORAGE.md`. It adds relative paths, existing question records and
Credits metadata together without replacing the bundled samples. The static
asset procedure below remains available for original bundled illustrations.

1. Add a stable asset entry to `packages/shared/src/visualAssets.ts`, or regenerate
   geography using `packages/shared/scripts/import-geography.mjs` and the source
   GeoJSON. Record source/license information and a source hash when importing.
   A photo entry uses `{ kind: "raster", width, height }`; add its licensed file
   under the mobile assets directory and a static `require` in
   `packages/mobile/src/components/visualImageSources.ts`. Unknown/missing mobile
   mappings fail preparation safely. Do not use an answer-revealing filename.
   For the original samples, `packages/mobile/scripts/export-visual-sample-svgs.mjs`
   regenerates the SVG sources, which can be rasterized at 600x440.
2. Add an authored record in `packages/server/src/content/visualQuestions.ts`.
   Pick the existing answer type, one prompt, the answer key/explicit aliases,
   editorial difficulty note, category and optional choices. Do not duplicate a
   prompt merely to change input methods.
3. Use presentation `{ format: "map_shapes" | "image_reveal", assetId }`.
   Maps additionally identify geography kind and stable ID. Keep answer keys
   out of the public presentation object and use exactly four choices for visual
   choice questions. No closest-answer conversion occurs for visual records.
4. Build shared/server, validate the catalog, and test all relevant modes before
   publishing. Update tests' intentional bank-size assertion when adding content.

Reveal timing/blur and preparation limits live in
`packages/shared/src/visualQuestions.ts`; Endless difficulty durations remain in
`packages/shared/src/config/endless.ts`.

## Files and database

New source: shared `visualQuestions.ts`, `visualAssets.ts`, `geographyAssets.ts`,
the geography import script; server `content/visualQuestions.ts`; mobile
`components/VisualQuestion.tsx`, `components/visualImageSources.ts`, three PNGs
and their SVG originals, the sample SVG export script;
`scripts/visual-questions.test.mjs` and this guide.

Integration changes: shared question/Endless types, correctness and round scoring;
server question selection/validation, `GameRoom.ts`, `state/schema.ts`, and Endless
content/engine/service/routes; mobile `App.tsx`, `QuestionScreen.tsx`,
`EndlessScreen.tsx`, and `RevealScreen.tsx`. Existing regression fixtures were
adapted to acknowledge visual readiness and validate answers against their actual
input type. Tracked shared/server build outputs were regenerated.

**No SQL migration or storage bucket is required.** This project authors questions
in server code; the existing private Endless JSON snapshots store new fields.
Existing Supabase Auth, RLS, currency transactions, and deletion policies remain.

Deploy matching server and JavaScript updates together. Endless protocol is now
**3**; `/health` must report `endlessProtocolVersion: 3`. Old servers are rejected
before Start by the existing compatibility guard. No new native module is used,
so a current Expo development client can reload these changes.

## Validation and remaining device work

- Full server/shared build and Node suite: **133 passed, 0 failed**.
- Mobile TypeScript `--noEmit`: passed.
- iOS and Android Hermes export: passed.
- `git diff --check`: passed.
- A local browser SVG sheet was rendered and inspected for all eight silhouettes
  and all three blur stages. This verifies the artwork, not native device blur.

The suite covers strict and normalized answer validation; numeric counts;
fractional stage boundaries; server-only stage rewards in all multiplayer modes;
confidence opt-out/penalties; Damage pot behavior; readiness and asset failures;
duplicate/stale messages; Endless loading, timeouts, +1 scoring, life loss,
repetition and key privacy; real embedded PostgreSQL persistence and once-only
milestone grants for written/numeric visual answers; and previous gameplay tests.

Still required: iPhone/Android playtesting of SVG blur and transitions, keyboard
and accessibility/font scaling, real two-device latency/reconnection tests and
matching Render/Supabase integration. No production account/database was used.
Partial outlines, highlighted regions, more geography, a curated photographic set and
player-calibrated difficulties can be added later; they are not implemented here.
