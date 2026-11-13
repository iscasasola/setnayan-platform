## 2026-11-13 · feat(maker): the Edit shell — a locked tab says Problem → Solution in the rows; the Camera keeps one style

Owner, 13 Nov 2026: *"maker shell approved"* (prototype `prototypes/approved_2026-11-13/maker-toolbar-fable.html` v3) and *"camera one style only."*

Step 1 of the Maker Edit shell. The toolbar's four tabs (Edit · Style · Background · Animate) are the same on every part; a tab with nothing to set on the picked part used to answer a tap with a toast over rows left blank. Now:

- the tab wears 🔒 (drawn by the toolbar's rule set, so the button is still only its word) and a tap opens **Problem → Solution in rows 1–3** (`stage-panel/tool-lock.tsx`) — the part's existing line as the problem, where it IS set as the solution (`makerPartToolLock` in `lib/maker-parts.ts`). A cover word's Background ends in the one tap that selects the Cover Scene. The work area's body stands aside while the lock is up (`data-stage-locked`, also watched by the style cards' sight check).
- **the Camera's Style tab is locked** with the one-style ruling: "The camera has one style." No style picker was added.
- help answer `maker-locked-tab` (Event Hub), a fourth stop in the Maker's spotlight tour (`maker-tool-tabs`), and an ⓘ on the lock's Problem line.

Guards: new `lib/a-locked-tab-says-problem-then-solution.test.ts`; re-aimed (claim unchanged — a grey tool's tap answers with its line and sets no tool) `a-tool-with-nothing-to-do-says-so`, `a-fixed-block-has-its-own-motion`, `the-preview-only-selects`; the anchor and the word "lock" registered in `spotlight-anchors-exist` and `the-couple-books-never-locks` (a locked tab is not a booking).

SPEC IMPACT: None (implements the approved prototype; DECISION_LOG 2026-11-13 rows "Maker Edit shell approved" and "Maker — Camera style" already record it).
