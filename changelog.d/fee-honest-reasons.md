## 2026-09-19 · fix(booking-fee): the lock path's refused reads keep their reason (FEE-HONEST)

S26 `result-dropped-silently`, money tier — the `booking-fee-lock.server.ts` sites S41 left behind,
after #5615 fixed the empty-ledger miss on the platform's first real booking.

- `resolveFeeAnchorRowId`: a refused booking read or anchor lookup still returns NULL (bill nothing),
  but is now logged via `logQueryError` and handed to a new optional `onUnreadable` sink. The
  acknowledge effects pass it, and `judgeDepositEffects` reports **"money row UNREADABLE (reason)"**
  instead of the false cause "archived booking or orphaned cascade line".
- `collectBookingFeeAtLock`: a refused existing-order check now SKIPS with its reason instead of
  reading as "no order yet" and minting a second bill (`orders.service_key` has no unique index); a
  refused payer read is `skipped: payer read failed …` instead of `no_payer` ("unclaimed supplier
  profile"); a failed rollback of the order after a failed payment insert is named in the reason.
- The `booking_fee_open_lock_charge` fail-open branch already carried its reason (#5615); unchanged.
- The three `booking-fee-charge.ts` RPC sites are covered by S34's #5707, not duplicated here.
- Test `lib/a-fee-lock-failure-keeps-its-reason.test.ts` runs every function against a refusing fake
  client, asserting the unchanged fallback and the recorded reason, with controls; 8 of 8 sabotages
  turn it red. Baseline `supabase-unread-error.baseline.txt` loses its `orders.delete` line.

SPEC IMPACT: None.
