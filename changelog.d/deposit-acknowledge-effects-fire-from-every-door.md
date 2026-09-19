## 2026-09-18 · fix(booking-fee): the deposit-acknowledge effects fire from every door, and every outcome is recorded

The platform's first real booking (event `rosa-ben` × Saysay Host and Band) reached
"deposit acknowledged" at 13:51:44Z through the payment card's **Confirm**
(`confirmVendorPayment` → RPC `confirm_vendor_payment`, which since H4 calls
`acknowledge_vendor_deposit` inside SQL for the deposit's row). The row was stamped, the
couple got their "confirmed your payment" email, and `booking_fee_ledger` /
`booking_fee_charges` stayed at 0 rows: the booking fee and the schedule reservation lived
only in the OTHER door, `vendorAcknowledgeDeposit`, and nothing logged their absence.
Verified against the Supabase API log for that second: `POST /rest/v1/rpc/confirm_vendor_payment 204`
and no call to `booking_fee_open_lock_charge` at all. A dry run of that RPC in a rolled-back
transaction returns `waived_free5` (Saysay's first sourced booking), so the row it should
have written was a waived one, not a bill.

- New `lib/deposit-acknowledged-effects.server.ts` — `runDepositAcknowledgedEffects` is the
  ONE place the two effects run (resolve the money row → `collectBookingFeeAtLock` →
  `acquireSchedulePoolsForBooking`). It reads `event_id` off the booking row, never from a
  form. Both doors call it. Never throws; idempotent.
- Every outcome is judged by the pure `lib/deposit-acknowledged-effects.ts` and written to
  the log on every call; anything that is not the expected shape (a skip with its reason,
  `no_payer`, a pool that did not settle, a throw) reaches Sentry as well. The old block
  reported `not_contracted` and discarded every other `{status:'skipped', reason}`.
- `maybeCatchUpAcknowledgedDeposits` runs post-response from the vendor layout (house
  cron-free sweep shape): the caller's own acknowledged bookings with no live fee charge get
  the effects now. This is what writes the waived row for the 2026-09-18 booking the next
  time that supplier opens the dashboard.
- The door guard found a THIRD caller of `acknowledge_vendor_deposit` on its first run:
  `acknowledgeDeposit` in `app/dashboard/[eventId]/vendors/actions.ts`, an exported server
  action with zero importers that could still stamp an acknowledgement without the effects.
  Deleted, not wired — dead code should not carry money logic.
- Guards: `lib/deposit-acknowledged-effects.test.ts` exercises the judge over the whole
  outcome space (a bare "skipped" with no reason is itself a failure);
  `lib/deposit-acknowledge-fires-from-every-door.test.ts` fails if any TypeScript caller of
  either acknowledging RPC does not run the effects inside the same action, if anything
  else calls the effects, or if the layout stops firing the catch-up. The existing
  `booking-fee-single-trigger.test.ts` now pins the collector to the effects module: still one
  trigger, still "when the supplier accepts the payment" (owner 2026-07-27, ruling 5 of 5).

SPEC IMPACT: None — the ruling is unchanged; the code now honours it from both doors.
