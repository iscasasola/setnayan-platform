## 2026-11-18 · fix(schedule): Home and Schedule say the same days-to-go (W4 B4)

Home said "212 days to go" and Schedule "213" for the same 19 Jun 2027: Schedule subtracted calendar days, Home counts whole days of real time left. New shared `daysToGoCount` in `lib/countdown-target.ts`; Schedule reads it. Guard `lib/days-to-go-is-one-calculation.test.ts` (fails without the Schedule change). W4 B5 (supplier counts) and B1/B3 remain owner questions, see #7959.

SPEC IMPACT: None.
