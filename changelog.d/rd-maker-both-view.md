## 2026-09-29 · feat(maker): View ▾ Both — the phone and the desktop side by side, both live

DECISION_LOG 2026-09-28 ("THE MAKER'S TOOLBARS ARE BUILT AFTER KEYNOTE + PAGES") put Desktop · Phone ·
Both in the Maker's View menu. #6075 hid "Both" because it was not built. This PR builds it.

- **The menu.** View ▾ now reads Desktop · Phone · Both. Both is offered only at 1024 px and wider
  (`makerViewOptions`, `maker-bar.ts`). If the window is narrowed below 1024 px, the canvas draws
  Desktop and keeps the pick, so widening the window brings Both back (`makerShownDevice`). The
  choice is remembered for the tab, like Desktop and Phone.
- **The canvas.** On the left is the desktop page: drawn at 1280 px and scaled to fit its pane
  (`bothDesktopFit`, `both-view.ts`). On the right is the phone page at 390 px. Both panes show the
  same draft at the same address.
- **One mechanism.** The desktop pane is the Maker's existing canvas: its `frameRef`, its warm
  stages and its hold. It keeps its place in the tree in every view, so switching views re-sizes it
  and never reloads it. The phone pane is one more `BufferedCanvasFrame`. It is keyed on the same
  held `canvasStamp` and reached by the same broadcast (`broadcastToCanvas`). So a pick the bridge
  draws shows in both panes at once. A held pick reloads neither pane. A save that reloads reloads
  both, double-buffered. There is no second editing path.
- **Selecting.** A tap in either pane selects the same scene or part. The other pane outlines the
  part and brings the scene into view (`postToShownCanvases`). Picking a navigator tile scrolls both
  panes. The part sheet's outline, Play this scene and Play this part reach both panes. The phone
  pane's own `ready` and its buffered swaps re-mark it. It never feeds the tiles or the Event Bar,
  which are still read from the desktop canvas.
- **Performance.** Both adds one extra frame, and only while it is on. The phone pane holds no warm
  stages on any device, so the ≤4 GB rule is unchanged. It unmounts as soon as the view changes. Its
  own canvas guard (`CanvasStaysOnThePage`) keeps it on the couple's page.
- **Not in Both.** The made-once pages drawn in their own frame (Hero · Reveal · Love Story) still
  show one frame, at desktop width, while Both is picked.
- **Guards.** New: `lib/the-maker-both-view-is-live.test.ts`. It failed under 7 separate sabotages,
  then passed after the source was restored. Updated for the built view:
  `the-maker-promises-nothing.test.ts` (the View menu may offer Both only while the canvas draws the
  phone pane) and `the-maker-toolbars-lose-nothing.test.ts`.

No migration. +0 exported `'use server'`.

SPEC IMPACT: `DECISION_LOG.md` gets an "AS BUILT — VIEW ▾ BOTH" row. Also, the "Both" view row in
`EVENT_HUB_BUILD_PLAN_2026-09-28.md` is marked built.
