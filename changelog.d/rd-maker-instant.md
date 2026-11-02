## 2026-09-30 · perf(maker): a pick the canvas already shows re-renders nothing — the part sheet is instant

Owner, 2026-09-30: *"every edit alteration create forces the whole screen to reload and sometimes take more than
10 seconds to change. when i pick something. it does not interact realtime."* The tester's four (the small top
line, the effects, the mark's − / +, the joiner) are all rows of ONE control, the part sheet
(`element-sheet.tsx`). DECISION_LOG 2026-09-30 "THE MAKER RE-PLAN — SPEED FIRST".

**Measured first (from the code — the live Maker cannot be signed into from a session):** every pick was drawn
on the canvas at once and then saved with `router.refresh()` behind it — a whole-Maker server render (3–6 s on
production, readings already in `element-preview.ts`; the route reaches 493 server modules / 540 query call
sites). Next.js runs server actions and `router.refresh()` in ONE serial queue, so the next pick's save WAITED
behind that render; the render then came back older than the canvas, the canvas hold saw a mismatch and
reloaded the canvas to the OLDER value, and the later save's refresh reloaded it again. Two picks 1.2 s apart:
2 whole-Maker renders, 2 canvas reloads, the canvas visibly going back, steady ~11 s later. Five − / + taps:
5 writes.

- `lib/maker-refresh.ts` — a `held` save (the bridge drew it) owes **no** refresh. A held burst that the bridge
  could not draw all of still ends in ONE (`makerNeedsRender`, called by the shell wherever it releases the
  canvas hold). Unheld writes (theme, hero design, add/move a scene, uploads, Undo · Restore · Apply) are
  unchanged. New `makerLatestWrite`: quick picks on one scene are ONE write — the latest canvas waits a
  350 ms beat, one in flight, one waiting, earlier ones `SUPERSEDED`; any unheld write flushes the waiting
  picks first so it lands after them.
- `lib/maker-draft-store.ts` (new) — the Maker's own copy of every scene canvas it wrote, for the session.
  With no render after a pick, the page's canvases stay as they were; the part sheet (both mounts), the scene
  panels and the words box now build on this copy, decided by content (the render caught up → dropped; a
  write still on its way → ours; the render moved on after our writes landed, e.g. Undo → theirs).
- The Apply · Undo · Restore count comes back **with the save**: `hubDraftAction` save + `bar=1` returns
  `hubDraftBarAfterSave` — the same `summarizeHubDraft` the render counts with, for BOTH answers to "owns Pro"
  (a server action must never see the view-as-free switch), and the toolbar picks its half with the render's
  own `ownsPro` (now read by `loadHubDraftBarData` even before a draft exists). Read beside the write, not
  after it.
- A refused pick puts that part back and says what did not save, in words
  ("Your mark: the new size did not save — it is back as it was.").

**After (same model, same latencies):** every pick on the canvas in the tap's own frame (unchanged), last tap
→ saved in 0.9 s, **0** whole-Maker renders, **0** canvas reloads, five − / + taps = **1** write.

Guards: new `lib/a-drawn-pick-never-rerenders-the-maker.test.ts` (the shared `makerSave` behaviour: held → 0
refreshes, unheld → 1; five taps → 1 write; every held save asks for the bar; the save-side bar never asks who
owns Pro; the sheet batches and builds on the Maker's copy), `lib/maker-draft-store.test.ts`, 8 new
`maker-refresh.test.ts` cases, and `every-maker-edit-shows-before-it-saves.test.ts` property **E**: a `held`
save (no render behind it) must put the change on the canvas first — a `held` on a change the bridge never
drew would leave the canvas on the old page for good. Sabotaged both ways before commit.

SPEC IMPACT: None (implements the 2026-09-30 SPEED FIRST row as written; no decision changed).
