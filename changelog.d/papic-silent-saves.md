## 2026-08-10 · fix(papic): nine save confirmations that were written and never shown

**PR 2 of 12** of the Papic three-room plan.

Nine outcomes were emitted by a `redirect()` on this route and read by **nothing
at all** — not one appeared in the page's `searchParams` type:

`style_set` · `style_error` · `quality_set` · `quality_error` · `showcase_set` ·
`showcase_error` · `faceTagging` · `vendorMedia` · `guestCameras`

So a couple changing their Papic look, their photo quality, face matching,
showcase state, vendor visibility, or when guests may shoot got **no answer at
all** — not on success, and, worse, not on failure. They tapped, something
happened or didn't, and the page just re-rendered.

🔑 **A guard that refuses in silence is indistinguishable from one that passed.**
Same family as the phantom column, the phantom enum value, the phantom RPC
argument and the blocked iframe: something happens and the only symptom is an
absence.

Each now confirms or explains, in plain English — what a person did, never the
name of the thing that stores it.

**The guard checks the whole chain, because any link alone passes while broken:**
the param is in the type (or it never arrives) · it is passed to something that
can render it (or it arrives and is dropped) · anything handed to the banner is
in the bail-out condition (or the block returns null before rendering) · and it
is actually rendered. **The outcome list is DERIVED from the action files**, so a
tenth outcome added tomorrow is checked without anyone remembering to add it.

⚠ **Three false starts, each fixed rather than loosened:**
1. Running the comment-stripper over all 1,900 lines **destroyed the marker it
   searched for**, and the slice came back EMPTY — which reads as "nothing to
   check" and would have passed every param forever. Regions are sliced from raw
   text and asserted non-empty.
2. It first demanded every outcome go through `StatusBanners`, and reported
   `papic_one_error` / `papic_pool_error` as dropped — they are handed to their
   own cards and shown there, correctly.
3. Its "is it consumed" scan searched to end-of-file, so `StatusBanners`' own
   internals satisfied it even with the page no longer passing the value —
   **it was reading the wrong half of the wiring.** Now scoped to the page's own
   render, and that sabotage is caught.

Mutation-tested four ways, baseline green, every sabotage verified applied:
dropped from the type (caught) · never passed to anything (caught) · dies at the
bail-out (caught) · wired through and rendered as nothing (caught).

SPEC IMPACT: None — no behaviour, price or feature changed; nine confirmations
that were already being written are now shown.
