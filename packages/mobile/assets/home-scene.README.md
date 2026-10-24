# Home scenery assets

Original images supplied by the game owner on 24 October 2026:

| File | Size | Transparency |
| --- | --- | --- |
| `background-new.png` | 1848 × 851 | Opaque RGB background |
| `left-side-clump.png` | 1448 × 1086 | RGBA, transparent background and soft edges |
| `right-side-clump.png` | 1448 × 1086 | RGBA, transparent background and soft edges |

`background-muted.png` (1847 x 851) is the active wallpaper: a less saturated
edit of the supplied `background-new.png`. The original stays available for
reference. The background has no runtime saturation/tint overlay.
`background-muted-blurred.png` (1847 x 851) is the pre-blurred version for all
other screens. AppFrame keeps both background images mounted with fixed sources,
placeholders and keys. Navigation changes their opacity only, avoiding another
image load when switching screens. There is no runtime wallpaper blur.
Source/rights documents remain with the owner; do not add private
receipts or generation/account records to this folder.

`HomeScenery.tsx` handles the separate layers and ambient light. `HomeMenuArtwork.tsx`
draws editable card glows and borders. The new wallpaper is shared across all
screens through `GAME_BACKGROUND` and `AppFrame`. The existing dark shade keeps
screen content readable. Foreground cutouts still use an alpha-masked grey pass
and reduced opacity, preserving those original PNGs.
Side props are 15% smaller than their initial integration, with softer ambient
lighting. Props use the physical frame coordinates supplied by
`ScreenFrameContext`, with original aspect ratios and responsive size caps.
They ignore input; the existing shortcuts, expandable menu and reward panel render
above them. Keep the source assets separate from text, controls and card art.

## Wallpaper edit

Created with the built-in image editing tool from the owner-supplied original.
Saved as `packages/mobile/assets/background-muted.png` and used globally.

Final prompt:

> Edit this existing game wallpaper: reduce the saturation of its purple and blue colors by about 30% so it feels a little calmer and less neon. Change color vibrancy only. Preserve the exact composition, every doodle and its position, the original linework, sharpness, texture, dark background, brightness, and landscape aspect ratio. Do not redraw, add, remove, blur, crop, or rearrange anything.

## Pre-blurred wallpaper

Created with the built-in image editing tool from `background-muted.png`.
Saved as `packages/mobile/assets/background-muted-blurred.png`; Home keeps the
sharp asset, while every other AppFrame screen uses this version.

Final prompt:

> Create a blurred version of this exact game wallpaper for screens behind UI. Apply a uniform moderate Gaussian blur, approximately a 10-pixel radius at this image resolution, baked into the image itself. Keep the original composition, framing, dark brightness, muted purple-blue palette, and every doodle in its existing location. Change only sharpness: do not redraw, add objects, crop, recolor, brighten, add text, or introduce gradients. Keep the same landscape aspect ratio and opaque background.

## Further vibrancy reduction

Both active PNGs were edited again with the built-in image editing tool to make
the wallpaper significantly quieter. Doodle highlights and the blue center glow
are dimmer, with much less purple/blue saturation. The same filenames stay wired
to the persistent sharp and blurred image layers; no runtime color filter was
added. Earlier edited versions are backed up in ignored `.codex-staging/`.

Final shared prompt:

> Edit the supplied wallpaper itself. Make the background substantially more subdued: reduce its current purple/blue saturation by another 60%, dim the bright doodle strokes and central blue glow by about 35%, and reduce their contrast against the near-black charcoal wall. The result should be a quiet, barely colored smoky purple-charcoal texture behind game UI, with faint but still recognizable doodles, rather than glowing purple or electric blue. Preserve the exact composition, all doodle positions, framing, and landscape aspect ratio. Do not add/remove/redraw elements, add text, crop, brighten, or introduce a grey fog over the dark base. Keep the background opaque.

Sharp-version suffix:

> Preserve the crispness of the original thin linework; do not blur this sharp main-menu version.

Blurred-version suffix:

> Preserve the existing uniform soft blur of this non-menu version; do not sharpen it or alter its blur strength.
