## 2026-11-25 · fix(supplier): final check area 5, batch 4

- Today says "You're done for today" once: the cover heading, not again in the all-done block (B5-27).
- The Bundle Maker's ✕ returns to Your packages when it was opened from there (`?from=packages`, a closed list);
  otherwise it goes to Shop, as before (A5-G6-04).
- Guard: `lib/supplier-batch4-holds.test.ts`.

SPEC IMPACT: None.
