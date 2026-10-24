# Image Reveal Storage integration

## Current discovery result — 24 October 2026

The configured Supabase project matches the supplied dashboard links:
`wgzltvwdiqrzmopvmtpi`. Read-only Storage list requests to the existing
`trivia-images` bucket returned HTTP 200 and `[]` for `animals`, `landmarks`,
and `objects`, using the configured publishable key. This means **zero visible
files**, not proof that the bucket contains no files. Listing can be hidden by
Storage SELECT policies. Dashboard links require the owner's signed-in session.

The owner subsequently supplied eighteen exact public URLs. All eighteen returned
JPEG images and were downloaded, visually inspected, dimension-checked and hashed.
**18 images inspected; 18 photo questions imported: 6 animals, 5 landmarks, 7 objects.**
Re-running the actual import added **0** questions. The original eleven visual
sample questions remain intact: 188 total multiplayer questions, 185 Endless
questions, and 29 visual questions including the eight maps and three original
illustration samples. `landmarks/hulki-okan.jpg` is Stonehenge. Numeric photo
questions count three giraffes and two physical dice, excluding reflections.

Rights records identify the supplied photos as **owner-reviewed,
documentation held by owner**, rather than independently inspected license proof.
No photographer identities, original photo-page URLs or exact license terms were
supplied, and none were invented. Credits lists these as owner-supplied Unsplash
photographs without claiming a specific license. Elephant and Mount Rushmore
were not supplied and remain excluded pending documented commercial rights.

## Implemented flow

The existing Image Reveal renderer now supports reviewed relative Storage paths,
resolved against `EXPO_PUBLIC_SUPABASE_URL` in the existing `trivia-images` bucket.
Only HTTPS and the three designated folders with PNG/JPEG/WebP extensions are
accepted. Paths are encoded; traversal, arbitrary URLs and query strings are rejected.
No secret key enters the mobile app. This implementation needs publicly readable
objects; it does not change bucket policies or create signed URL infrastructure.

Images use the existing native image load acknowledgement before server timers
start. Failed or slow downloads use the existing no-penalty replacement question.
The existing three reveal stages, server timestamps, multiplayer 3/2/1 stage base
points and Endless +1 scoring are unchanged.

The server catalog is incorporated into the existing question pool, including
Endless. Categories are `animals`, `landmarks` and `objects`; no separate question
database or selection system is introduced. Written aliases and exact numeric
answers use the existing backend validators.

Settings now includes a scrollable Credits section. Imported images generate
source/license links and photographer names only when supplied in reviewed metadata;
owner-reviewed images without those details appear as an Unsplash photo group.
Public metadata excludes answer keys, review notes and license evidence.

## Discovery and import

From the repository root:

```powershell
npm.cmd run build --workspace=packages/server
node packages/server/scripts/import-image-reveal.mjs --discover
node packages/server/scripts/import-image-reveal.mjs --import path/to/reviewed-images.json
npm.cmd run test:unit --workspace=packages/server
node node_modules/typescript/bin/tsc --noEmit -p packages/mobile/tsconfig.json
```

Discovery reads the existing mobile environment files or explicit environment
variables. A server-only `SUPABASE_SERVICE_ROLE_KEY` can provide listing access
locally if available; never paste it into chat or prefix it `EXPO_PUBLIC_`.
Alternatively, supply actual public file URLs/paths from the dashboard: the import
can verify these exact paths by downloading even when anonymous listing is hidden.
No path is guessed, and no download alone establishes image rights.

The reviewed JSON is an array of the following records. These are **schema
placeholders**, not an uploaded asset or a valid license record:

```json
[
  {
    "assetId": "photo_0123456789abcdef",
    "storagePath": "animals/ACTUAL_UPLOADED_FILENAME.jpg",
    "category": "animals",
    "width": 1200,
    "height": 800,
    "review": {
      "inspectedAt": "YYYY-MM-DD",
      "subject": "VISUALLY_CONFIRMED_SUBJECT",
      "sha256": "64_LOWERCASE_HEX_CHARACTERS_OF_INSPECTED_FILE",
      "countEvidence": "Required only for numeric questions: describe each counted subject"
    },
    "rights": {
      "license": "unsplash",
      "sourceUrl": "https://unsplash.com/photos/VERIFIED_PHOTO_PAGE",
      "licenseUrl": "https://unsplash.com/license",
      "unsplashPlus": false,
      "evidence": "Location of saved source/download/license proof; confirm this actual photo",
      "photographer": "ONLY_IF_VERIFIED"
    },
    "question": {
      "id": "reveal_photo_0123456789abcdef",
      "type": "word",
      "difficulty": "medium",
      "text": "Which animal is shown?",
      "answer": ["VERIFIED_NAME", "ACCEPTED_ALIAS"]
    }
  }
]
```

Use an opaque stable ID (for example the first sixteen hex characters of a random
UUID without hyphens). For multiple choice, use `type: "multiple_choice"`, exactly
four distinct `options`, and a zero-based integer `answer`. For exact counts use
`type: "estimate"`, an integer `answer`, and inspection evidence. Do not infer
counts, species, landmarks or rights from filenames. English is the launch
language; generated BG entries retain English until localization is reviewed.

The ordinary Unsplash setting requires an explicitly verified free photo page,
`unsplashPlus: false`, and evidence. Elephant/Rushmore require
`license: "documented-commercial"` with the applicable source, license URL and
evidence, including when a licensed replacement is used. The importer validates
metadata completeness; human review must establish that the evidence is genuine.

Keep rights documentation, receipts and private review notes under `.private/`.
That folder and `*.private.md`, `*.private.json`, and `*.private.txt` files are
ignored by Git; private records and staging files are also excluded from Docker.
Never put actual API keys or tokens in public documentation.

An explicit owner confirmation can instead be recorded using `license:
"owner-reviewed"`, `provider: "Unsplash"`, `reviewedBy: "game-owner"`, `reviewedAt`,
`documentation: "held-by-owner"`, and the exact basis in `evidence`. This records
who reviewed the rights without inventing photo-page links or specific terms.
It does not admit elephant/Rushmore. The currently imported eighteen entries use
this basis, following the owner's confirmation in this task.

Before writing any catalog outputs, the importer downloads every incoming public
image, checks content type, a 10 MB size ceiling and SHA256 against the inspected
file. Optimize large originals first. It refuses conflicting asset IDs, paths or
question IDs, preserves existing questions, and importing the same reviewed records
again adds zero entries. It generates:

- `.private/image-reveal/storageImageCatalog.json`: local-only authoritative review records, ignored by Git;
- `packages/server/src/content/storageImageQuestions.ts`: private answer-bearing questions;
- `packages/shared/src/storageVisualAssets.ts`: public relative paths and credits.

No SQL migration or remote database write is needed. No Storage files are renamed,
deleted or uploaded, and no policies are modified. Rebuild shared/server/mobile
together after import so all clients recognize the new asset IDs.

The importer requires the local private catalog so it can preserve existing
records; do not replace it with an empty file when updating an existing bank.
The generated TypeScript catalogs contain only gameplay content and public
credit metadata. Runtime and builds do not require the private review records;
the local consistency check skips on CI when those records are absent.

## Validation and remaining steps

Current checks: 143 server/shared tests passed; mobile TypeScript passed; iOS and
Android Hermes exports passed. No real-device photo loading was tested.

Automated coverage verifies URL restrictions, append-only/idempotent imports,
rights exclusions, all three category projections, written aliases, choice/count
validation, failed/changed/oversized downloads and generated catalog consistency.
Existing gameplay tests verify stage timing, multiplayer scoring, Endless +1,
readiness, fallback and reconnect behavior.

Still needed: native iPhone/Android checks of real remote downloads, blur, keyboard
and two-device timing after publishing matching server and mobile JavaScript.
Expo exports and automated tests do not establish native device behavior. Full
original photos are approximately 0.26–2.08 MB each, at 3000–8160 pixels on a side;
optimized smaller Storage copies would improve cold loading and memory use. No
originals were replaced. The owner retains the rights documentation; add exact
source/license links and individual credits when those records are made available.
