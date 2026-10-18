# HANDOVER — rd/logo-ornament-l5 · started 2026-10-18 ~17:45 PHT by the controller

L5 of the Logo maker replot. APPROVED: corpus DECISION_LOG 2026-10-08 "LOGO MAKER REPLOT APPROVED, WITH ORNAMENT" — owner
verbatim "approve add ornament" (REVERSES the 2026-10-06 ornament removal); ＋ Add layer = Text · Image · Frame · Ornament.
Read LOGO_MAKER_REPLOT_2026-10-08_fable.md (L5 section) + prototypes/logo_maker_replot_2026-10-08_fable.html (the
"Ornament: A flourish, a leaf, a star" row) via `git -C ~/Documents/Claude/Projects/Setnayan show origin/main:<path>`.
L2–L4 just merged (#6638): layer cards, ＋ Add layer list, tools row, character extras — extend those, never redraw.
BUILD: Ornament as a 4th Add-layer kind, with the doc's ornament set (if the doc lists shapes, use exactly those; if it
says "a flourish, a leaf, a star", ship those three as vector shapes in the app's existing ornament/frame asset style),
recolourable like Frame, sized/rotated by the same sliders + pinch/twist, Hide/Lock/Duplicate/Delete like any layer,
animatable through Animate (Pro as shipped). The guard "the logo adds three things only" must be updated to allow
Ornament (it currently bans it) with a dated note citing the 10-08 ruling. Keep the Maker first-load budget (0.1 KB left
— lazy-load ornament assets; never raise it). 375 px shots light + side-by-side vs the prototype row.
HARD STOP 19:45 PHT tonight: commit + push, keep this HANDOVER current — the work continues on a new account.
Own walk folder (scratchpad/logo-l5-walk/). Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-logo-ornament-l5.md.

## STATE (builder, 2026-10-18 ~17:50 PHT)
DONE + pushed: `lib/logo-ornaments.ts` (closed set of 6 = the prototype's ORN ❦ ✿ ❧ ✦ ⚜ ❖ → Flourish · Blossom · Leaf · Star ·
Fleur-de-lis · Diamonds, plain filled paths, `data-ornament` names it in the body) · `'ornament'` in `LOGO_LAYER_KINDS`
(+label only — the first-load file carries no shapes) · Add list 4th row "Ornament — A flourish, a leaf, a star" (Flower2
icon) · `addOrnament` (flourish, frame gold #C5A059, y 0.2, scale 0.4, Draw on) · Style › Ornament ▾ (ChosenRow, beside
Frame ▾). New guard `lib/the-logo-adds-ornaments.test.ts` (5 tests; sabotaged 7 ways → each red). Re-aimed (dated notes):
the-logo-adds-three-things-only (Ornament allowed), the-logo-is-layers (Add list of 4), studio-logo-are-the-templates
(5 ChosenRows). 118 logo tests pass locally. Fragment `changelog.d/rd-logo-ornament-l5.md`.
Calls made (no ruling): which-ornament lives in the body, not the config (first-load budget); names for the 6 glyphs; the
dropdown lists names (PickMenu has no picture slot — same as Frame ▾); ornament keeps "How it's written" (prototype shows it).
NEXT: walk (scratchpad/logo-l5-walk/walk.mjs, lab /dev/maker-lab?studio=1 › Logo, port 3675) → shots + side-by-side →
draft PR, label do-not-auto-merge, disable auto-merge → CI watch.
