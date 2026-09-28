## 2026-09-28 · fix(maker): "No background" now takes the widget's own card off the canvas

Owner, 2026-09-28, with a screenshot: in the Event Hub Maker, Format → Background →
"No background" on the Countdown scene, and the canvas kept showing the Countdown's own
semi-transparent pink card. The draft and the server render were both right; reloading the canvas
frame flipped the section from `data-scene-card="own"` to `"bare"`.

**Cause.** The instant-Maker canvas HOLD (`element-preview.ts`) kept the page for the render the
save brought, because the bridge had already painted the scene's frame (`sceneBg`). But whether a
widget draws its OWN card is decided server-side (`lib/scene-ground.ts` `sceneWidgetIsBare`, read
by both dispatchers) — nothing the bridge lays can take that card off or put it back. Same class
for every widget carrying `data-scene-card` (Countdown, the generic hideable card, Photo moments,
Tier comparison), in both directions.

**Fix.** `backgroundPickRedrawsBox` (`element-preview.ts`) asks the SAME function the server asks
(`sceneWidgetIsBare` → `hubBackgroundOwnsBox`) for every touched scene, before vs after the pick.
When any answer flips, `SceneBackgroundRow` tells the shell (`onSaving(canvases, redrawsBox)`) and
the shell releases the hold instead of holding, so the save's render reloads the canvas through the
existing double-buffered swap (no flash, scroll kept). Every other background pick stays instant. A
photo or snippet the Maker holds no URL for is never guessed — that pick reloads too.

What the couple sees: the card (and the countdown's four per-number tiles) goes when the save's
render lands — about the time of a save plus a page load — with the old page kept on screen until
the new one is ready (no blank, no manual reload). Plain · Glow · Frosted · Framed ↔ Full width
after that stay instant (the bridge paints them, nothing reloads).

Tests: `lib/no-background-drops-the-card.test.ts` (new — the owner's pick releases and the server's
HTML really drops the card; the countdown's per-number tiles go with it; non-flipping picks are
still held; the reverse direction brings the card back; unknown media reloads; the wiring).
`lib/a-maker-pick-never-reloads-what-it-drew.test.ts` wiring anchors updated to the new `onSaving`
shape.

SPEC IMPACT: None
