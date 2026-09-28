## 2026-09-28 · feat(maker): "No background" takes the scene's own card off the canvas at once

Owner, 2026-09-28, on #6073 (the card went only when the save's reload landed, ~2–3 s):
*"yes must be instant"* (DECISION_LOG "OWNER ANSWERS ON THE FREE VS PRO REDRAW + NO BACKGROUND").

**What the couple sees.** In the Event Hub Maker, Format → Background → **No background**: the
scene's own card — and the Countdown's four number tiles — are gone the moment it is tapped. Going
back to no background at all ("Use the Event Hub's", removing a scene's photo) brings the card back
the same way. Measured in a local harness at 390 and 375 px with touch: gone ≤ 69 ms, back ≤ 46 ms
(before: ~2.8 s).

**How, without a second rule.**
- `lib/scene-card-look.ts` (new) holds each widget's two card looks as class strings. The Countdown,
  the generic hideable card, Photo moments and Tier comparison now render
  `sceneCardClass(look, bare)` / `sceneCardTileClass(bare)` — the same strings as before, so guest
  pages render byte-for-byte the same.
- The Maker puts the server's own answer in the `sceneBg` message: `sceneCardBareFor`
  (`element-preview.ts`, = `sceneWidgetIsBare`, or nothing when a photo's URL is not in hand — never
  a guess). `backgroundPickRedrawsBox` now reads the same helper.
- The bridge lays the frame, then `applySceneCardPreview` swaps the card to the look for that answer
  using those same strings. Anything it does not recognise is left for the reload.
- The save's buffered reload (#6073) still runs and still decides; the instant card is proved to be
  byte-for-byte what that reload renders.

Tests: `lib/no-background-hides-the-card-at-once.test.ts` (new) — convergence both directions for
every card widget (the server's HTML, swapped, equals the server's HTML for the other answer), the
tiles, inside a scene frame, unknown cards untouched, every `data-scene-card` reads the table, the
message carries only the server's answer, the wiring.

SPEC IMPACT: None
