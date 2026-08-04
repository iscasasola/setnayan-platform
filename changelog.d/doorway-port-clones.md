## 2026-08-04 · refactor(marketing): three more doorways onto the shared archetype — and a guard for what the port nearly deleted

Third slice of `design#6`. `/patiktok`, `/panood` and `/palogo` now render the shared doorway kit. Five of eight ported; three remain.

Line counts: **265 → 154**, **285 → 180**, **265 → 156**. What's left in each file is copy, destinations and structured data — the shape lives in one place.

**The kit gained one slot.** `/panood` carries a YouTube-API-Services disclosure that must sit *after* the FAQ, so the archetype now has an `epilogue` alongside `children`. Two named slots, not a general layout escape — a page still cannot reorder the spine, and an exception still looks like an exception.

### ⚠ The port silently deleted that disclosure, and only a manual diff caught it

The extraction dropped the paragraph from `/panood`'s render. The page still built, still typechecked, and **every test stayed green** — including the doorway invariants shipped earlier today, which check the h1, the canonical and the JSON-LD but knew nothing about this.

It is not decorative copy. The 2026-06-29 *"never name YouTube"* rule was **reversed for exactly this paragraph** so an OAuth reviewer can find it, and Live Studio's Google access depends on that review. Losing it is a compliance regression that looks like a tidier page.

Restored, and now guarded: a test asserts `/panood` renders the disclosure and still links the privacy policy. **Mutation-verified** — deleting the epilogue fails with *"the disclosure paragraph is gone from /panood"*.

The general lesson, which is the reason this is written down rather than quietly fixed: **a refactor that preserves structure does not preserve intent.** Everything the kit models survived automatically; the one paragraph that existed for a reason outside the design is exactly what fell out. The remaining three doorways each carry something similar — `/papic` a live price anchor, `/alaala` a linked pillar grid — and each gets checked before, not after.

**Three doorways remain:** `/papic` (private motion fork, catalog-driven price anchor, no kicker), `/alaala` (the umbrella page — orb, five linked pillar cards, two-button CTA), `/setnayan-ai` (already solved this shape independently). `/` stays excluded; `/features` remains its own job.

Verified: 6449/6449 unit tests, `tsc --noEmit` clean, lint clean. No visual change — identical rendered markup, including the restored disclosure.

SPEC IMPACT: None.
