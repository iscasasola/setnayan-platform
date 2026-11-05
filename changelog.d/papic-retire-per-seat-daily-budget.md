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

## 2026-11-05 · refactor(papic): the Unlock pass and the PAPIC_SEATS pack come off — no shot is free

Owner, 5 Nov 2026, asked whether anybody still holds either: *"no one. remove both"*. Both were already off sale; this
removes what they still did for an event holding one.

- **Seat camera** (`app/papic/actions.ts`, `app/api/upload/route.ts`): an Unlock event no longer records at cost 0 or
  skips the credits probe, and its two umbrellas no longer free paid camera rungs. A seat that is not a per-camera seat
  (the pack's) is refused outright at both steps, the same refusal it already got from every event without the pack.
- **Guest camera**: migration `20271309535584` re-creates `papic_record_guest_capture` without the Unlock lookup
  (body copied from the latest definition, one block removed); `fetchGuestQuota` and `papicGuestCapLifts` drop the
  matching disjunct. The pot's yield and the couple's per-guest ceiling are unchanged.
- **Pool**: `papic_event_pool_config.pass_service_codes` emptied (and its default), so no "flat pass" sizes a pool.
- **Pack setup**: the `PAPIC_SEATS` activation hook, `provisionPapicSeatsAdmin`, the studio `provisionPapicSeats`
  action and the `papic_provision_seats` RPC are deleted. Helpers with no caller left are deleted too
  (`eventHasPapicUnlock`, `eventUnliFreeViaUnlock`, `eventLtdFreeViaUnlock`, `eventOwnsPapicSeats`,
  `eventPapicSeatsActive`). The Memories uploader loses its "Your pass covers these" state.
- Proof: `tests/db/papic-unlock-and-seats-pack-are-gone.db.test.ts` (seeds the exact paid orders that used to unlock
  each behaviour; all four tests go red without the migration) and `lib/papic-unlock-and-seats-pack-are-gone.test.ts`.
- Kept on purpose: the retired codes stay in the retired-code lists, and the two Unlock rows in
  `platform_package_catalog` stay deactivated (never deleted) so old records still resolve.

SPEC IMPACT: None — implements the owner's 2026-11-05 answer as given.
