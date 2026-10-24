# Confivia content-rights ledger

Status: **unverified**. This is an inventory, not a claim that the game has
commercial-use rights for these assets. Before store submission, record the
creator/source, licence or ownership basis, commercial-use permission, and a
saved proof (receipt, licence text, creation record, or written permission) for
each asset or clearly related asset family.

## Images and icons

| Asset family in `packages/mobile/assets/` | Rights status | Evidence needed |
| --- | --- | --- |
| `app-icon-ios.png`, `emblem-logo*.png` | Unverified | Logo creator/ownership and any source material |
| `avatars/`, `avatar-heads/`, `avatar-thumbnails/`, `combat-ios/`, `combat-ios-defeated/`, `combat/` | Unverified | Original or AI-generation records, source inputs, model/service terms, commercial-use permission |
| `ranks/`, `star-packs/`, `shop-tabs/`, `ui-thumbnails/` | Unverified | Creator/source and commercial-use licence for each family or individual file |
| Other root-level PNG, WebP, and SVG files | Unverified | Source and commercial-use licence per file; identify original, generated, purchased, and third-party assets |

Optimized copies and thumbnails should be linked to their source asset; they
do not need a separate licence if they are only derivatives of a licensed original.
Deleted assets in the current worktree are excluded from this inventory until
the final bundle is assembled.

## Audio

| File in `packages/mobile/assets/sounds/` | Rights status | Evidence needed |
| --- | --- | --- |
| `buttons_click.mp3` | Unverified | Source URL/creator, licence, proof |
| `confidence_choosing.mp3` | Unverified | Source URL/creator, licence, proof |
| `game_music.mp3` | Source candidate: [“Roblox Minecraft Fortnite Video Game Music” by MaksymMalko](https://pixabay.com/music/video-games-roblox-minecraft-fortnite-video-game-music-358426/), listed under the Pixabay Content License. Local file match and download proof unverified. | Confirm this is the actual file, then save the source page, licence, and download record. The source page marks this track as Content ID registered. |
| `room_countdown.mp3` | Unverified | Source URL/creator, licence, proof |
| `timer_countdown_gameroom.mp3` | Unverified | Source URL/creator, licence, proof |
| `virtual_vibes-light-bubble-pop-383738.mp3` | Source candidate: [“Light Bubble Pop” by Virtual_Vibes](https://pixabay.com/sound-effects/film-special-effects-light-bubble-pop-383738/), listed under the Pixabay Content License. Local file match and download proof unverified. | Confirm this is the actual file, then save the source page, licence, and download record. |

## Question content

Supabase Image Reveal photos: integration supports reviewed paths in
`trivia-images/{animals,landmarks,objects}`. Eighteen public URLs supplied by the
owner on 24 October 2026 were downloaded and visually inspected: six animals,
five landmarks and seven objects. All eighteen are now enabled. Records mark their rights
as **owner-reviewed, documentation held by owner**. This is not an independent
verification of license documents. Exact photo-page links, photographer identities
and license terms were not supplied and are not claimed. Settings > Credits groups
these as owner-supplied Unsplash photos. Private review details are retained locally
under the Git-ignored `.private/image-reveal/` directory. See
`IMAGE_REVEAL_STORAGE.md` for the public integration process.
Elephant and Mount Rushmore remain excluded without documented
commercial-use rights.

Map Shapes uses Natural Earth 1:110m admin-0 geography, dedicated to the public
domain by its maintainers: https://www.naturalearthdata.com/about/terms-of-use/.
The source URL, SHA256, projection and import procedure are recorded in
`VISUAL_QUESTIONS.md`; generated paths live in `packages/shared/src/geographyAssets.ts`.
Image Reveal's pyramid, owl and four-red/two-green apple illustrations are
original code-drawn paths in `packages/shared/src/visualAssets.ts`. These three
samples use no third-party photographs. Their rasterized 600x440 PNGs and source
SVGs are bundled in `packages/mobile/assets/visual/`; the SVG export script is
`packages/mobile/scripts/export-visual-sample-svgs.mjs`. The eleven authored prompts and verified
answer keys are in `packages/server/src/content/visualQuestions.ts`. This does
not close the older question bank's provenance review.

Endless menu illustration: `packages/mobile/assets/endless-mountain-chalk.png`
was generated with the built-in image generation tool on 23 October 2026,
using the user's menu image as a style reference. The exact prompt and tool
provenance are recorded in `packages/mobile/assets/endless-mountain-chalk.prompt.md`.
It is an original transparent mountain/path/flag composition, not a flattened UI.
This bitmap is now retained only as historical artwork and is not imported by
the app. `packages/mobile/src/components/EndlessMountain.tsx` replaces it with
original code-drawn SVG mountain ridges, a winding path, clouds and a summit flag.
The leaderboard's crown markers are also original SVG paths in
`packages/mobile/src/components/EndlessLeaderboardPanel.tsx`. No external vector
asset or third-party illustration was copied for these replacements.

The question bank is in `packages/server/src/content/questions.ts` and
`generatedQuestions.ts`. Its source and copyright-sensitive material still
need review. Record how each imported or generated batch was created and
retain permission or provenance evidence for any externally sourced wording.

`packages/server/src/content/endlessQuestions.ts` reuses that bank and adds
72 original, code-generated mathematical questions (combinations, sums of
squares and modular powers), written during the Endless implementation on
23 October 2026. Their wording, distractors and answer calculations are present
in the source; no external question dataset or new image/audio asset was added.
This does not resolve the existing bank's outstanding provenance review.

## Completion rule

Do not mark the content-ownership checklist complete until every shipped file
has a documented rights basis and the supporting evidence is stored outside
the public app bundle. Replace or remove any asset whose rights cannot be
established. Re-run the inventory after final asset cleanup.
