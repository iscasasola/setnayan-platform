## 2026-07-25 · feat(vendor-pricing): free-tier booking-cap DB trigger (flag-dark)

Phase-3 hard enforcement of the LOCKED 2026-07-25 vendor monetization model —
the DB-level backstop for the free-tier 3-concurrent-booking cap whose pure logic
shipped in `lib/vendor-free-tier-booking-cap.ts`.

`migration 20271001120000_free_tier_booking_cap_trigger.sql`:
- adds `platform_settings.free_tier_booking_cap_enabled` (BOOLEAN, default FALSE);
- adds `enforce_free_tier_booking_cap()` + a BEFORE INSERT/UPDATE trigger on
  `event_vendors`. When the flag is on, a NEW lock (transition into
  contracted/deposit_paid/delivered) by a FREE-tier (`free`/`verified`)
  marketplace vendor is blocked with a `check_violation` once that vendor already
  holds 3 concurrent active bookings.

Mirrors the proven `enforce_booking_requires_verified_vendor` trigger
(20270927437859): SECURITY DEFINER, gate only the transition-in, marketplace
vendors only, grandfather already-active rows. Enforces across every lock path
(finalizeVendor + slot RPC + wizard + package cascade) in SQL, so it needs no
edit to the payment session's lock code.

SHIP-DARK: `free_tier_booking_cap_enabled` defaults FALSE → the trigger is a pure
no-op and locking behaves exactly as today. ⚠ Do NOT flip it until a follow-up PR
teaches the lock paths to catch this violation and show the friendly "Fully
booked" state + upsell (otherwise a capped 4th lock surfaces a raw error). Only
the couple's Lock action is gated; inbox/chat never are.

Migrations auto-apply on merge — verify `free_tier_booking_cap_enabled` +
`enforce_free_tier_booking_cap_trg` landed in prod (manually trigger
`supabase-migrations.yml` if the auto-apply skips).

SPEC IMPACT: None (implements the already-locked model + DECISION_LOG 2026-07-25).
