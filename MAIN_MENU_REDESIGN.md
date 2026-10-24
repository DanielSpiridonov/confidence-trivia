# Main menu redesign

The three horizontal actions are replaced by portrait chalkboard cards in the
purple / blue / orange order of the supplied concept. The original home routes,
account gates, side shortcuts, root settings/rule-book/Stars controls, expandable
menu and daily reward presentation continue to use their existing handlers.

- `HomeModeCards.tsx` owns card labels, subtitles, full-card touch targets, bundled
  font loading, hover/press highlights and native-driver lift/scale animations.
  Taps navigate immediately and retain the existing sound/haptic wrapper. Reduced
  motion keeps color feedback and removes movement. Font failure keeps a system
  handwriting fallback and does not block the menu.
- `HomeMenuArtwork.tsx` owns original SVG illustrations, irregular chalk borders,
  static fibers, glowing edges and soft colored light along the sides and floor. It does not
  rasterize the interface. Memoized artwork avoids rebuilding hundreds of static
  fibers during reward countdown ticks or card animations.
- `HomeControlBackdrop.tsx` adds subtle clipped blur behind each left shortcut.
  The hamburger instead uses a solid dark backing, pale border and white
  code-drawn bars so it remains distinct against the foreground artwork.
  Decorative backings render after the scenery, ignore touches and
  leave the icons, labels and notification badges sharp. Expo SDK 54's matching
  `expo-blur` version is installed; Android opts into its native blur method.
  Existing clients without that native module use a dark translucent fallback
  until rebuilt. Non-Home screens use `background-muted-blurred.png` with the
  blur baked into the asset, replacing runtime wallpaper blur. Menus, questions,
  controls and Home's wall remain sharp.
- `HomeScenery.tsx` uses the three owner-supplied PNGs: `background-new.png`,
  `left-side-clump.png`, and `right-side-clump.png`. A less saturated edit of the
  wall (`background-muted.png`) is used globally through
  AppFrame, with the existing dark readability shade and no color-tint overlay.
  Ambient lighting and true-alpha foreground props appear only on Home. Props are
  15% smaller with a matching grey tint and reduced opacity, and sit
  above the cards but below shortcuts, menus and reward overlays; decorative
  layers ignore touches and accessibility focus. The owl and mug are positioned
  to keep the Endless title and infinity visible. No source image was regenerated
  or flattened with UI.
- `homeMenuLayout.ts` fits equal cards into the measured safe design canvas.
  Native platform-specific gutters reserve the existing left rail, top HUD and
  bottom-right menu; expanded menu items remain an overlay above the cards.
  The original safe-area handling remains in `Screen`.
  The new `ScreenFrameContext` expresses physical frame bounds in design-canvas
  units. Home alone opts into `fullBleedDecorations`, allowing the foreground to
  reach screen edges without a seam at the notch while controls remain safe.
  Other screens retain clipped viewports and share the new, muted background.
- Kalam Bold and Regular are explicitly declared through `expo-font`, already
  present in this Expo SDK through existing font/icon dependencies. Original OFL
  and copyright notices are retained beside the fonts and readable offline in
  Settings > Credits. No API key or service call is required; scenery is bundled.

Validation: mobile TypeScript and iOS/Android Hermes exports pass. An isolated
browser harness rendered the actual HomeScreen/card/layout code with React Native
Web, web SVG elements and mocked native services, and checked six viewports:
667×375, 852×393 with left and right iPhone notch reservations, 1280×590, Android
844×390, and tablet 1024×768. It verified card bounds, clearance from existing
side/corner controls, bundled typography, all three navigation callbacks and the
expandable menu. It also checks full-frame scenery coordinates and real pointer
clicks through the foreground. Reduced-motion hover leaves the card transform unchanged.
All 148 server/shared regressions pass, including existing safe-area layout checks.
Preview screenshots and dependencies are under ignored `.codex-staging/`.

Browser renders cannot establish native font rasterization, haptic feel or GPU
performance. Still check a real iPhone and Android device in both landscape
orientations, large text, daily reward celebration and the expanded menu. An
existing Expo development build can reload the JavaScript and bundled assets;
there is no server deployment or database migration for this redesign. The
native shortcut blur added afterward requires one new development build;
existing builds retain the translucent fallback until then.

## Development asset loading

The dev-client tunnel command no longer clears Metro's transform cache every
start. Use `npm run dev:mobile:client:clean` only when a cache reset is needed.
Use `npm run dev:mobile:client:lan` for a direct connection when the phone and
PC share a network. The normal `dev:mobile:client` command still uses a tunnel.
Restart Metro for a changed launch command to take effect.

Combat artwork preloading now waits for a Damage room snapshot, including one
received after navigation. Other multiplayer modes no longer start the 21-image
combat preload (about 8.9 MiB of source files). Deferred work and its state
listener are cancelled when leaving the room. The current four scenery PNGs
total roughly 6 MiB, so a cold tunnel download can still take noticeable time.
