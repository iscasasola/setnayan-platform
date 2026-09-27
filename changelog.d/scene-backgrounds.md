## 2026-09-27 · feat(maker): a scene's background is its box — six choices, framed or full width

DECISION_LOG 2026-09-27 "A SCENE'S BACKGROUND EXISTS TO SEPARATE IT FROM THE NEXT" · "NO BACKGROUND
MEANS NO BOX…FRAMED OR FULL WIDTH" · "A SCENE IS AS TALL AS ITS CONTENT", and 2026-09-24
"BACKGROUND COLOUR IS FREE; A MEDIA BACKGROUND IS PRO".

- **Six kinds** in `lib/hub-canvas.ts` (the one store — `HubSectionCanvas`): No background · Full
  colour · **Opaque glass** · **Frosted glass** · Photo · Snippet. Both glasses are tinted from the
  scene's SAME colour (`--hub-bg-color`), so the colour holds with or without the effect; a glass
  chosen before any colour is a clear pane. An absent `kind` is still a PHOTO for legacy rows —
  `resolveHubBackground` stays the one place that rule lives.
- **Framed or Full width** (`shape`, default Framed): framed is an inset rounded panel in the page's
  column (the one sanctioned rounded surface, on the `--m-r-lg` token); full width breaks out edge
  to edge, square, while its padding keeps the words exactly in the column.
- **"No background" means NO BOX.** A widget that drew its own card now draws it only when the couple
  chose no background at all (the page as it always looked). With No background — or any painted
  ground, which IS the box — Countdown (panel + a tile per number), Photo moments, Tier comparison and
  Event details draw no card: the numbers stand on their own. One reader decides for the frame and
  both dispatchers: `lib/scene-ground.ts` (`sceneGround` · `sceneWidgetIsBare`).
- **Photo / Snippet cover the scene in proportion** and never set its height; a scene is as tall as
  its content.
- **Maker:** a "Background" row on the scene panel with the six choices, and Framed / Full width
  under it — every choice a form through `setWidgetBackground` with `<HubDraftField />` (the draft;
  +0 server actions). Colour, both glasses, No background and the shape are free; Photo / Snippet
  wear the paid mark and are Pro at Apply (hidden in the store shell). The old media "None" chip is
  gone — "No background" is the one None.
- **Guests see exactly the choice** — server-rendered, closed sets only; a hostile colour or shape
  is dropped, never stored or emitted.
- The SEC-6 snippet gate moved with the ground reader into `lib/scene-ground.ts`; its guard
  (`hub-canvas-frame-snippet-gate.test.ts`) now pins the gate there AND that the frame reads its media
  URL only through it.
- Held by `lib/a-scene-background-is-the-box.test.ts` (rendered through the real frame + Countdown;
  sabotage-checked).

SPEC IMPACT: None — implements the four DECISION_LOG rows as recorded.
