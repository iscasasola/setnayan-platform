## 2026-06-26 · fix(a11y): burn down all sub-12px guest-facing text — guest-legibility baseline to zero

Cleared every grandfathered Guest Legibility Floor violation (`text-[<=11px]`)
across the 12 guest-facing files the baseline had tolerated since the floor
shipped 2026-06-20 — **81 occurrences**. Each was a small `font-mono` uppercase
tracking **label** (kicker / overline / badge / meta / caption / header
wordmark), so all were bumped to `text-xs` (12px) — the floor's small-label
minimum; none were instructional/CTA elements caught below 12px.

- **One exception:** the Save-the-Date film's "Created at Setnayan" branding
  **watermark** (owner-set subtle at `opacity-35`, 2026-06-19, pointer-transparent,
  non-actionable) carries a `legibility-ok` exemption rather than a size bump, to
  preserve the owner's explicit "subtle branding" intent.
- Also re-applied the `guest-venue-3d` nav-hint fix (**identical** to #2226) so
  this branch is self-consistent and the two PRs converge cleanly.
- `.guest-legibility-baseline.json` regenerated to `{}` — **the floor is now
  fully enforced** (any new sub-12px guest text fails the lint). This unblocks
  promoting `lint guest legibility` to a *required* status check.

Layout-risk note (from the per-file review, fixed regardless since legibility
wins): 5 areas in `editorial-content` — pill badges (`#1 Match` / tier), a tight
2-col grid cell, truncating overlay figcaptions, and two flex-wrap link rows —
get slightly larger labels and may wrap one extra line on narrow viewports.
Cosmetic only; no overflow.

SPEC IMPACT: None — enforces the existing Guest Legibility Floor spec
(`02_Specifications/Guest_Legibility_Floor_2026-06-20.md`); no schema / SKU /
pricing / flow change.
