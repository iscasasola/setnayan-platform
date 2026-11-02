## 2026-09-18 · fix(marketing): "3 couples inquired" mockups track the real floor, not a copy of it (SUP-73)

Two marketing surfaces hardcode the literal "3 couples inquired for your
date": the App Store on-card demo (`studio-card-demo.tsx`) and a baked JPEG
(`/add-ons/demo/stills/setnayan-ai-2.jpg`, used by
`setnayan-ai-value-copy.ts` for wedding-type events). Both were already
honest by coincidence — `MIN_DEMAND_COUPLE_COUNT` (`lib/compat-score.ts`) is
3, the smallest number the real "N couples inquired for your date" chip can
ever show — but a copy of the value, not a reference to it, drifts silently
the moment the floor changes.

- `studio-card-demo.tsx` now renders `{MIN_DEMAND_COUPLE_COUNT}` instead of a
  literal `3`.
- The baked JPEG's pixels cannot be re-rendered from code, so
  `setnayan-ai-value-copy.test.ts` gets a new test
  (`SUP-73 — the baked "3 couples inquired" still matches the real demand
  floor`) that pins `MIN_DEMAND_COUPLE_COUNT === 3` and names the exact file
  that needs a fresh screenshot the day that stops being true.

SPEC IMPACT: None.
