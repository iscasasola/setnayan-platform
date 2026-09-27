## 2026-09-27 · fix(maker): every element choice shows on the canvas instantly

The owner, editing his own Event Hub: *"changing size does nothing"* · *"the
toolbars are not working"* · *"this applies to the rest of the toolbar"*. The
element sheet's saves worked, but the canvas showed a choice only ~6 s later:
~3 s for the draft save and refresh, then the canvas iframe REMOUNTED (its key
carried `renderStamp`, a fresh `Date.now()` on every server render) and took
~3 s more to load. Motion was never seen at all, because the reload hid the
arrival it had just replayed.

- **Instant preview.** On every choice (font, colour, size, motion, per-letter
  runs, every reset) the sheet posts `elStyle` to the canvas BEFORE the save.
  The bridge (`app/[slug]/_components/editor-bridge.tsx`) lays it through the
  guest page's own functions, never a second mapping: `hubElementDeclarations`
  for a hero part's inline style, `hubTextSegments` + the new
  `hubRunDeclarations` for its runs, and `hubElementSceneCss` for a scene's
  scoped `<style>`. A motion change replays the part's In; a font, colour or
  size change never touches the animation. Measured locally: 4–55 ms from tap
  to the restyled part, at 390 px and on desktop.
- **No reload for an element save.** The stage iframe is keyed on a held
  `canvasStamp`. A server render whose canvases are exactly what the canvas
  already shows (within 15 s of an element choice) keeps the page. Every other
  render (scene order, background, Undo, Restore, the Save-the-Date lead
  switch, a lapsed hold) reloads it as before. The save still refreshes the page,
  so the toolbar's Apply · Undo · Restore count stays true.
- **Every other Maker write no longer blanks the page** (owner: *"everytime we
  edit something, the loading takes time and loads the whole screen"*). The
  canvas is double-buffered (`buffered-canvas-frame.tsx`). A new render loads in
  a hidden frame behind the page the couple is looking at; the old page stays
  visible and tappable, and the new one swaps in when its bridge says `ready`.
  The scroll carries across: the selected scene stays at the same height on
  screen. A new stage or a new "view as" still switches at once. At most two
  frames exist; a newer render replaces the one loading. Measured locally with
  a 2.5 s page load: blank time 2.5 s → 0 ms, and the scroll held
  420 → 420 px. The swap does not make the server faster: a background change
  still shows after save + load (~3.5 s here).
- **A refused save reverts** the canvas and the sheet to the last saved look and
  shows the sheet's existing error. A server canvas that arrives while a save is
  still on its way is no longer adopted over the newer choice.
- **The mark's size steps are real**: S · M · L · XL measure 129 · 152 · 182 ·
  220 px tall on the card, and nothing clips. No scale numbers changed.

Guarded by `apps/web/app/dashboard/[eventId]/website/editor/_components/element-preview.test.ts`
(server HTML vs the bridge's live write on the same input, the canvas hold, the
revert, the replay; each seen to fail by sabotage).
`lib/the-maker-controls-are-compact.test.ts` now pins the iframe key to
`canvasStamp`.

SPEC IMPACT: None.
