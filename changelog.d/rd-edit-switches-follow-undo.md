## 2026-10-18 · fix(maker): Edit's switches (and Cover › Animate) follow the draft after ↺ · Reset · Restore · a merged save

Measured by the two-hosts round-3 walk (origin/main e11f5346 and #6632, WebKit 375): Cover › Edit › Date off → ↺ — the
cover drew the Date again, and the Date switch still read off six seconds later.

**Causes.** (1) `stage-panel/cover-lines.tsx` showed its own pick over the draft for good (`own[part] ?? l.shown`), so
nothing the draft did afterwards could reach the switch; `cover-animate.tsx` seeded `useState(stored)` once. (2) A drawn ↺
(`lib/canvas-pick-undo.ts` → `noteDraftedCanvas`) and a merged save (#6626 `elsewhere`) change the Maker's own copy with
NO Maker render, and `stage-tools.tsx` re-read the cover's lines only on `renderStamp`. (3) Found on the walk: Date off ·
↺ · Date off was MERGED AWAY ("Changed on another screen…", Date shown) — the ↺ left the screen's last-SENT canvas as the
next save's base (`sendCanvasBase`), so the server read the second pick as "this screen kept the Date hidden, another
showed it".

**Fix — one shared rule, lazy (never the first load):** `launch/_components/stage-panel/follow-draft.ts` —
`usePickUntilDraftMoves(truth)` shows a panel's own pick only until the draft moves (pure step `followDraft`), and
`useDraftMoves()` hears every move of the Maker's copy no render brings (`hearDraftedCanvas`; a merged save's
`merged.widgets[*].canvas`, noted into the copy). Applied to Cover › Edit's lines, Cover › Animate and the toolbar's
cover-lines read. `lib/maker-refresh.ts` passes `merged` on the `elsewhere` announcement (a few bytes of first load).
`lib/canvas-pick-undo.ts` forgets the sent base when a pick is drawn back (and when a refused ↺ puts it back).
Not touched (open #6639 owns them): `stage-background.tsx`, `cover-words-background.tsx`, `element-sheet.tsx` — the last
already hears `hearDraftedCanvas`, as Style's row (`stage-look-row.tsx`) does.

Test: `stage-panel/follow-draft.test.ts` (5) — ↺ · Reset · a merged save · Date off ↺ Date off · the panels use the rule;
sabotaged 8 ways. `lib/two-hosts-never-overwrite.test.ts` 12 re-anchored to the new announcement shape.

SPEC IMPACT: None
