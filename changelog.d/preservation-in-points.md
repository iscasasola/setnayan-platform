## 2026-08-10 · fix(preservation): counted in Papic points — 5,000 pts for ₱500/year

Owner: *"let's just use the papic credits as the count so it will be
consistent"* · *"5000 pts for 500/year"*. Supersedes the same-day
"3,000 photos or 150 videos" figure.

**One unit, and it is the one the couple already buys their shots in.**
1 photo = 1 pt · 1 ten-second clip = 8 pts, so ₱500 preserves **5,000 photos, or
625 videos, or any mix**. "The pool you bought is the pool you keep" stops being
a slogan and becomes literally the same number.

### 🔑 The ratio is DERIVED, never re-typed

`PAPIC_POINTS_PER_PHOTO = 1` / `PAPIC_POINTS_PER_CLIP = 8` already govern every
capture path, with `papic-copy-guardrails.test.ts` failing CI if a surface
re-grows a literal. `preservationUnits` now calls `papicCaptureCost()` rather
than keeping a local `CLIP_UNITS`. A second copy of a ratio is how the day-of
console and the floor console came to disagree about who counts as booked.

A test asserts `5_000 / PAPIC_POINTS_PER_CLIP === 625`, so if the clip cost ever
moves again the preservation promise moves with it instead of drifting.

### 📐 The existing ratio is safely conservative at the new 1080p cap

- 5,000 photos × ~4 MB ≈ **20 GB**
- 625 videos × ~20 MB ≈ **12.5 GB**

A clip-heavy couple consumes *less* storage than a photo-heavy one for the same
points. No new ratio to invent and nothing to keep in sync.

### 🪤 Five files said a clip costs 7 — a month after it was raised to 8

Corrected in `papic-cameras.ts` (**the very file that defines 8**),
`llms-txt.ts`, `vendor-papic-tier.ts`, `papic-event-pool.ts` and
`papic-tier-copy.ts`. The executable value was right everywhere; only the prose
was stale — sitting in exactly the files someone would open to answer *"how much
is a clip?"*. The owner asked precisely that, guessing 10, and the honest answer
had to come from the constant rather than the comments.

### Verified

**7287 / 7287** unit tests · `tsc --noEmit` clean · 19 lint scripts pass.
The preservation test is retermed to points (11/11).

⏭ Next: the couple picks WHICH captures to preserve, and a Preserved view —
owner-locked today, nothing of it exists yet (checked in both code and schema).

SPEC IMPACT: `DECISION_LOG.md` 2026-08-10 — applied and pushed.
