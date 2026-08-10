## 2026-08-10 · feat(preservation): the couple can see and choose what stays sharp

Owner: *"they can pick which one to preserve. where we will see the preserved
photo/video."* The foundation (the mark, the point accounting, the per-capture
sweep) landed in #4299; this is the half a person actually uses.

### What ships

- **A "Kept sharp" filter** beside All / Photos of us / Untagged / Videos — the
  "where we will see the preserved" half of the ask.
- **A line above the grid**: *"148 of 200 kept at full resolution · 31%"* with a
  bar. Shown to EVERYONE, not just payers, so being over what you bought is
  legible before it matters rather than six months later.
- **A gem on each tile** — green when kept, dark when released. One tap.
- **A write path** (`setCapturePreserved`) that is couple-only, scoped to the
  event on both the read and the write, and refuses a capture whose original has
  already gone.

### 🗣 The wording carried more risk than the code

This is the one control in the product where a couple can quietly cost
themselves something, so:

- **Nothing says "delete" or "remove".** Releasing lets the original be replaced
  by the compressed copy that already exists; the photo stays in the gallery for
  five years either way. A test fails if the word "delete" appears in the action.
- **The tooltip warns before the tap**, not after: *"it stays in your gallery,
  just smaller, and that cannot be undone later."*
- **An already-compressed capture renders as a plain, unclickable marker.** The
  server refuses it too — but a control that accepts a tap and changes nothing is
  the thing worth not building.

### Derived, never re-typed

The meter counts through `papicCaptureCost` and `PRESERVATION_BLOCK_POINTS`, the
same constants every camera spends against, so the bar can never disagree with
what a capture actually cost.

Vendor documentation captures are excluded — those are the vendor's own files on
their own retention, not the couple's to hold.

### Verified

**7317 / 7317** unit tests · **926 / 926** database tests · `tsc --noEmit` clean ·
19 lint scripts pass.

🪤 The database suite first reported 5 failures — **an artefact of running it
from the repo root instead of `apps/web`**, where those tests resolve their
paths. A wrong-directory failure and a real failure look identical in the output.
Re-run correctly: 926/926. Worth recording because it is the same shape as the
exposure-baseline miss earlier the same day: a result that looks like a verdict
and is actually a fact about how it was invoked.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-10 — applied and pushed.
