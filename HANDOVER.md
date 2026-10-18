# HANDOVER — rd/logo-maker-l2-l4 · started 2026-10-18 ~14:00 PHT by the controller

Owner 2026-10-18 list item 8 (approved-not-built designs: the Logo maker replot) + "Continue as it becomes available".
Ship-on-green authorised through 19 Oct. CONTRACT: corpus LOGO_MAKER_REPLOT_2026-10-08_fable.md (+ its prototype folder
prototypes/logo-maker-replot-2026-10-08/), LOGO_MAKER_BUILD_STATUS_2026-10-08.md. L1 #6421 MERGED.
BUILD L2 (layers carousel: layer cards, hold-drag reorder, ⋯ Duplicate·Delete, ＋ Add layer), L3 (tools row), L4
(character extras) exactly as specified, incl. the owner's touch gestures (pinch/twist bound to the sliders) and removal
of the frame chips / workspace Play per the doc. NOT L5 (ornament) — it waits for the owner's yes; name it as left.
Prior unwired WIP: origin/rd/logo-maker-l2-wip @ c851df68e (3 files: logo-layer-cards.tsx, cardDropIndex, moveLayerTo) —
far behind main; PORT those files by hand onto this branch (never merge/rebase that branch).
Files: app/dashboard/[eventId]/launch/_components/maker-logo.tsx, logo-layer-cards.tsx, lib/logo-layers.ts,
lib/logo-maker-layout.ts. Animated logo = Pro (ANIMATED_MONOGRAM / Event Hub Pro); keep the gating as shipped.
Keep the Maker first-load budget (≈0.2 KB left — lazy-load the Logo maker pieces; never raise the budget).
375 px shots light + dark + side-by-side vs the replot prototype. Never open the owner's cale-ice Maker.
Other builders touch other Maker parts (own-section photos, two-hosts save paths) — don't touch their files.
Own walk folder (scratchpad/logo-walk/). Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-logo-maker-l2-l4.md.

## Builder log (2026-10-18, builder L2–L4)
Plan (one PR, three commits-ish): L2 carousel (port WIP by hand: LogoLayerCards → logo-layer-cards.tsx, cardDropIndex →
logo-maker-layout.ts, moveLayerTo → logo-layers-edit.ts [NOT logo-layers.ts — first load]) · L3 tools row
[Character|Style|Animate]·▶·ⓘ, hidden?/locked? · L4 spacing?, split into letters, looks (Outline · Shadow).
Decisions taken (no ruling in the record — matched to the docs):
- Hidden layers are composed into a leading `<defs data-logo-hidden>` (not drawn by any surface; print-mark treats defs as
  non-rendered) so a hidden IMAGE layer's shapes survive a reload; `logoInkBox`/player see only `data-logo-layer`.
- Lock is stamped `data-locked=""` on the layer's group so a lock alone is a real change the save gate sees.
- Hide · Lock · Duplicate · Delete: on the picked card's ⋯ (owner addendum 08 Oct) AND the Style row (doc §3/prototype).
- Kept shipped controls the prototype does not draw: Name (rename, owner 09-28 ask) and Centre it — in Style.
- ▶ plays the picked layer (its delay kept), the rest held still — prototype `play()`; there is always a picked layer (L1).
- LOGO_SCALE_MIN 0.1 → 0.02: a split letter keeps its size inside the word (its own ink box is small).
State 2026-10-18 ~15:00: draft PR #6638 open (label do-not-auto-merge, autoMerge null). L2 · L3 · L4 built; L5 NOT built.
Walks (lab, port 3671, stopped): Chromium 812 + 667 16/16, WebKit 812 14/14. Shots: ~/Documents/Claude/Projects/shots-2026-10-18/6638/.
New guard sabotaged 6 ways (all RED → GREEN). Local full tsc OOM'd at 7 GB — CI typecheck is the gate. Corpus status line pushed (011a1e13).
Next: watch CI to green; fix reds; delete this file when green.
