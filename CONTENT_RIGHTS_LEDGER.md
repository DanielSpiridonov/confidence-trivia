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

The question bank is in `packages/server/src/content/questions.ts` and
`generatedQuestions.ts`. Its source and copyright-sensitive material still
need review. Record how each imported or generated batch was created and
retain permission or provenance evidence for any externally sourced wording.

## Completion rule

Do not mark the content-ownership checklist complete until every shipped file
has a documented rights basis and the supporting evidence is stored outside
the public app bundle. Replace or remove any asset whose rights cannot be
established. Re-run the inventory after final asset cleanup.
