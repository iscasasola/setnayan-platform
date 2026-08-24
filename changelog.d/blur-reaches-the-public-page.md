## 2026-08-24 · feat(privacy): the blurred web copies, and ONE answer to "does this photo need blurring?" — part 1 of 3

Owner ruling 1 of 2026-08-17: *"Public = everyone except the couple — blur on the venue wall, the public event page, and the shared pool other guests browse. The couple's own album stays unblurred."*

⚖ **THIS PART IS INERT ON PURPOSE. Nothing reads the new copies yet.** It only adds them, and moves an existing rule into one place. The change that alters what a person actually sees is part 2, so it arrives on its own and can be reasoned about by itself.

### Why this is not a filter change

The venue wall projects `wall_safe_r2_key` — a full-size blurred JPEG. Every PUBLIC read serves something else entirely: the AVIF web copies (`display_r2_key` 1280 · `tile_r2_key` 640 · `thumb_r2_key` 320) that `lib/papic-derivatives.ts` bakes once per capture, and it does so **deliberately** — those are the metadata-stripped ones. `lib/papic-gallery.ts` states the rule they follow: a public frame is *"ALWAYS a metadata-stripped display/thumb derivative — NEVER the geo-bearing original. A frame with no such derivative is SKIPPED."*

So **there was no blurred copy in any size a public page uses.** `generateSafeDerivatives` now makes three, in the same sizes, from the already-blurred image, fired straight after the bake — the only moment those bytes are known to exist.

🔒 **A NEW FILE, NEVER AN OVERLAY.** A CSS/overlay blur still ships the real photo to the device and can be switched off in two taps; it looks private and is not. `lib/face-blur.ts` already blurs *"into the pixels, never CSS"*. **Verified across the codebase: every blur effect in the product is decoration** (sticky bars, pop-ups, seating chips) — nothing anywhere stands in for privacy. These copies keep it that way: what leaves R2 for a public page has no face in it.

🪤 **A SECOND COMPRESSION PASS, KNOWINGLY.** The house rule is ONE lossy pass (owner 2026-07-11) — the web copy is born AVIF from the full-res original. The blurred source is a JPEG the baker produced, so these are pass two. Accepted rather than worked around: the alternative is teaching the baker to emit AVIF at three sizes, which would put face detection on the critical path of every capture. It runs ONLY for captures that need a blur — today **none in production** — so it costs nothing at rest, and it is invisible on a blurred face by construction.

⚖ Deliberately fired **after** `wall_record_bake`: the venue wall must light up on the bake alone and never wait on the public sizes. A failure leaves the wall correct and the public surfaces withholding — the safe direction for both.

### One answer to "does this need blurring?"

The rule already lived **twice** — inline in `wall_visible_photos` and again in `wall_ingest` — and part 2 was about to add a third and fourth copy in the public readers. **Checking a column in three places is three chances to forget, and the next surface makes four**; this codebase has already paid for exactly that with the photo wall, where three guest surfaces each asked SKU-ownership and nothing else.

`papic_capture_needs_blur(event, table, id)` is now the single definition, with a set form for pages holding a list — **defined in terms of the scalar**, so there is still only one rule. Both wall functions were rewritten to call it.

⚖ **The two reasons keep DIFFERENT shapes, because the owner ruled them differently:** FaceBlock is **event-wide** (one guest with it on ⇒ every capture); withdrawal is **per-photo, via tags**. Folding them into one shape is the likeliest wrong simplification and would silently change who is protected, so there is a test for each. The FaceBlock half filters `deleted_at` and the withdrawal half deliberately does not — also pinned, so neither is "tidied" into the other.

### Verification

9 new db assertions with an anchor that fails if an ordinary photo already needs blurring (so nothing passes vacuously), including that the scalar and set forms **can never disagree**, that the rule does not leak across events, and that the three new columns exist on **both** capture tables — a missing one reads as a phantom-column rejection, which would look exactly like "no safe copy" forever.

🔑 **The refactor is proved behaviour-preserving, not asserted:** all **9 existing assertions** in `withdrawal-blurs-and-keeps.db.test.ts` still pass unchanged against the rewritten wall functions. The rule only moved.

**Four mutations, each measured by occurrence count, each red, each restored green:** FaceBlock made per-photo (`AND FALSE` 0→1) · withdrawal made event-wide (1→0) · the `deleted_at` filter removed (1→0) · the set form no longer asking the scalar (1→0).

⚠ **One mutation first reported "did not land" and that was the MEASUREMENT, not the mutation** — for an *insertion* the counter was watching the anchor, which survives. Re-measured on the inserted text: 0→1, landed, two tests red. Second time today; the rule is that an insertion is measured by what was inserted.

SPEC IMPACT: None yet — nothing reads these copies until part 2. Ruling 1 remains partly unbuilt until the public read paths change.
