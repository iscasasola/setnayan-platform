## 2026-10-23 · perf(maker): the canvas editor's own reads leave at once — its queue after the page 5 trips → 2

After #6850 shipped (the tools arrive behind the Maker), production on a phone still showed the canvas starting only
as the Maker page ended: the editor that draws it (`website/editor/page.tsx`) had its own queue — its event row, then
the Pro question, then its batch of nine reads, then the scenes' content map, then Post Event — five trips in single
file after the page returned.

- **Inside the Maker** (`maker=1`, read off the address before any read) the editor's batch and its Pro question now
  start beside its event row (`startEditorReads`, `readPro`). Every gate still stands where it stood and every value is
  still awaited where it was; a viewer the gates turn away is redirected with nothing drawn (a started read's answer is
  dropped). **Opened on its own** — every save lands here, then forwards to the Maker — nothing starts early, so that
  path still forwards before any of them leaves. Nothing started early writes.
- **Post Event** (`readPostEventForMaker`) is started as soon as its inputs — the event's dates and the draft — are in,
  past the couple-only gate; the same one call, awaited where it was.

Read harness (150 ms a database trip): the page with its editor **12 → 9** trips deep, the canvas's reads done
**1,846 → 1,385 ms** (this morning, before #6850: 20 deep, 3,050 ms); the page itself and the tools' lane unchanged
(7 and 13), same 94 reads. `the-maker-reads-start-together.test.ts` tightened 13 → 10 — sabotaged (the early start off)
fails test 2. `post-event-is-many-small-scenes.test.ts` now checks the same unconditional call through `postEventRead`.

SPEC IMPACT: None — implements the 2026-09-28 / 2026-09-29 Maker speed rulings; no product decision changed.
