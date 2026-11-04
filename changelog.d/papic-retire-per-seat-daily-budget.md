## 2026-11-04 · refactor(papic): retire the per-seat daily budget — every capture draws from the one shared pool

Owner, 5 Nov 2026 (DECISION_LOG "THE 15 'ACT FIRST' ITEMS", item 12): *"retire. we do not have papic seat anymore"* —
confirming 2026-09-16 "ONE POOL OF CREDITS, SHARED BY EVERYBODY".

- `app/api/upload/route.ts` no longer reads `papic_tier_config.points_per_day` to choose its refusal sentence, and the
  409 body no longer carries `dailyBudget`. The refusal, its `code` and its `reason` are otherwise unchanged.
- `lib/papic-exhaustion-truth.ts`: `exhaustionDetail` takes `{ buyOffered }` only; both "daily allowance resets
  tomorrow" sentences are gone.
- The seat camera (`app/papic/seat/[token]/_components/papic-seat-capture.tsx`) drops its `dailyBudget` state and the
  never-emitted `daily_photo_quota` / `daily_video_quota` cap codes.
- Dead per-day helpers deleted: `PAPIC_TIER_QUOTA`, `papicTierDailyLimit` (`lib/papic-cameras.ts`),
  `papicCapacityPhrase` ("about N photos a day") and the `pointsPerDay` config field (`lib/papic-tier-copy.ts`). None
  had a caller.
- Kept, per the rulings: `paparazzi_seats` (the camera claim), the per-guest ceiling (`papic_guest_spend_ceilings`,
  owner 2026-09-16 *"ceiling"*), and a camera's own credits (`papic_seat_point_usage`, the free-camera grant kept by
  2026-10-23).
- No money path changed: the per-day budget had no enforcer left (its two SQL readers were dropped in 20271234330879
  and 20271286935967). New proof: `tests/db/papic-no-daily-budget.db.test.ts` (on every tier, each capture debits the
  shared pool by its exact cost; an empty pool refuses with no photo written; no SQL function reads the per-day
  budget) and `lib/papic-no-daily-budget.test.ts` (no app code reads, writes or mentions it).
- No tables dropped. Now unused, for a later cleanup: `papic_seat_day_usage`, and the column
  `papic_tier_config.points_per_day`.

SPEC IMPACT: None — implements the 2026-11-05 ruling (item 12) as written.
