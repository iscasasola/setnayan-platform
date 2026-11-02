## 2026-10-18 · feat(maker-logo): the Logo maker replot L2–L4 — layers carousel, tools row, character extras

Owner 2026-10-08, `LOGO_MAKER_REPLOT_2026-10-08_fable.md` (approved: *"approve add ornament"*) + the 08 Oct addenda.

- **L2 · Layers carousel** (`logo-layer-cards.tsx`, ported by hand from the unwired `rd/logo-maker-l2-wip`): one card
  per layer where the event bar was (a desk's left column), top of the stack first; hold then drag to reorder
  (`cardDropIndex` → `moveLayerTo`); the picked card's ⋯ = Hide · Lock · Duplicate · Delete; ＋ Add layer opens ONE
  list in the panel (Text · Image · Frame). The four frame chips and the Play on the logo are gone (owner 08 Oct).
- **L3 · Tools row** `[Character | Style | Animate] · ▶ · ⓘ`: Character (text only) · Style (Looks · the kind's own
  control · Colour · Size · Across · Up and down · Rotate · Hide · Lock · Duplicate · Delete) · Animate (Build in ·
  Action · Build out over the shipped motion). ▶ plays the picked layer. Pinch = Size, twist = Rotate on the picked
  layer — the slider values themselves; a gesture is one save, so one Undo step. `hidden?` / `locked?` on the layer
  (JSONB, no migration); a hidden layer is kept in a leading `<defs>` no surface draws, so it survives a reload.
- **L4 · Character extras**: Spacing (`spacing?`, hundredths of the size), Split into letters (each letter where it
  stood, its own layer and start), Looks Solid · Outline · Shadow (the Stages' Style cards).
- `LOGO_SCALE_MIN` 0.1 → 0.02 so a split letter keeps its size. L5 (Ornament) is not built.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/LOGO_MAKER_BUILD_STATUS_2026-10-08.md` — one line for L2–L4 (this PR).
