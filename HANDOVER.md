# HANDOVER — rd/edit-switches-follow-undo · started 2026-10-18 ~17:45 PHT by the controller

BUG (measured by the two-hosts round-3 builder on origin/main e11f5346 AND on #6632, WebKit 375): after ↺ in the Maker,
the canvas redraws (e.g. the Cover's Date shows again) but the Edit panel's part switches keep the pre-undo state (Date
switch still off, aria-checked "false" 6 s later) until the next render. Pictures:
~/Documents/Claude/Projects/shots-2026-10-18/6632/light-main-b-undo-6s.png and light-b-undo-greyed.png.
FIX: the Edit panel (and any Maker panel showing draft values — Style rows, Background, Animate) must read the draft
after ↺ / Reset / Restore / a merged save ("Changed on another screen…" from #6626) exactly like after a normal edit.
Find why the panel keeps local state (probably initialised once from props) and make it follow the draft — one shared
fix, not per-panel patches. Test: ↺ after toggling a part off → the switch shows on; same after Reset and after a merged
save. Sabotage it. 375 px WebKit before/after shots. Never open the owner's cale-ice Maker. Keep the Maker first-load
budget (0.1 KB left; never raise it). Other builders: Logo L5 (logo files), Look restudy (#6639, Look/background panels)
— if the shared fix lands in a file #6639 changes, keep the change minimal and say so.
HARD STOP 19:45 PHT tonight: commit + push, keep this HANDOVER current — the work continues on a new account.
Own walk folder (scratchpad/undo-switch-walk/). Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-edit-switches-follow-undo.md.

## STATE (builder, 2026-10-18 ~18:05 PHT)
CAUSE (found): (1) `stage-panel/cover-lines.tsx` showed its own pick over the draft FOR GOOD (`own[part] ?? l.shown`);
`cover-animate.tsx` seeded `useState(stored)` once. (2) a drawn ↺ (`lib/canvas-pick-undo.ts` → `noteDraftedCanvas`) and a
merged save (#6626 `elsewhere`) change the Maker's own copy with NO Maker render; `stage-tools.tsx`'s cover-lines read
re-ran only on `renderStamp`.
FIX (one shared module, lazy): `launch/_components/stage-panel/follow-draft.ts` — `usePickUntilDraftMoves(truth)` (pick
shown only until the draft moves; pure step `followDraft`) + `useDraftMoves()` (hears `hearDraftedCanvas` and the
`elsewhere` save status; notes `merged.widgets[*].canvas` into the copy). `lib/maker-refresh.ts` (first load, ~10 B)
now passes `merged` on the `elsewhere` announcement. Applied: CoverLines, CoverAnimate, stage-tools cover-lines effect.
NOT touched (#6639 owns them): stage-background.tsx, cover-words-background.tsx, element-sheet.tsx (element-sheet and
stage-look-row already hear `hearDraftedCanvas`). post-event-shown re-reads on every render; its saves are never held.
NEXT: test `stage-panel/follow-draft.test.ts` + sabotage → WebKit 375 walk before/after → fragment → draft PR.
