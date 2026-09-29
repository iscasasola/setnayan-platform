## 2026-09-29 · feat(maker): the Main background offers every choice — the theme's own · same as my hero · Upload media · none

Owner, on the live Maker's "Main · behind every scene" panel (Luxe): *"the
background animated video cannot be unpicked. also the upload media is not on
the background. and the theme background is also not there."* (DECISION_LOG
"THE MAIN BACKGROUND OFFERS EVERY CHOICE…").

- **One list of four**, the scene background's shape: **{Theme}'s own
  background** (its still as the thumbnail) · **Same as my hero** · **Upload
  media** · **None — just the colour**. Every pick can be undone; the theme's
  loop is never forced (the old "Your hero is the written invitation card, so
  Luxe's own background stays…" dead end is gone).
- **Stored on the key the Main background already had** (`config_json.main` on
  the hero row, drafted): two new states `{ ground: 'theme' }` and
  `{ ground: 'none' }` (`HubMainChoice`). No migration, +0 server actions.
  `resolveMainGround` draws no picture for either; `mainGroundLayerFor` answers
  "none" first (free, no ownership read) with `MainGroundNone` — the SAME style
  switch `MainGround` already uses to hide the theme's loop and poster — and lays
  nothing over the Background colour.
- **Upload media** is the scene picker's: the couple's pictures (hero, gallery,
  the Save the Date upload, a scene's own uploads), the one video, the 10
  ready-made Save the Date scenes, and the in-place upload (unchanged
  `main-background/` folder). An existing picture's colours are read off its URL
  like the hero's; Apply accepts every picture the picker offers.
- **Still · Parallax** on the couple's own photo — the shipped
  `PahinaCoverParallax`, with a page-scroll mode for this fixed layer
  (`data-pahina-parallax="page"`).
- **Pro unchanged:** the theme's own and none are free (taking media down is a
  removal); media, the adaptive tint and Parallax are Pro — ◆ PRO while tried
  (`makerProMark`), Apply asks.

Guards: `lib/the-main-background-offers-every-choice.test.ts` (each part seen red
once); `lib/page-ground.test.ts` counts `<MainGround` exactly (not `None`).

SPEC IMPACT: DECISION_LOG "AS BUILT — THE MAIN BACKGROUND OFFERS EVERY CHOICE" (corpus).
