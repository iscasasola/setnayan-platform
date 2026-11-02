## 2026-06-29 · feat(vendor): Booked-Out Waitlist (Wave 4 vendor benefit)

End-to-end Booked-Out Waitlist across all three surfaces.

- **Migration** `20270320335355_vendor_date_waitlist.sql` — new `public.vendor_date_waitlist`
  (waitlist_id, vendor_profile_id, event_id nullable, requested_date, user_id, status
  pending|notified|converted|cancelled, created_at, notified_at). RLS enabled at CREATE
  TABLE time with canonical helpers: couple INSERT/UPDATE own rows (`user_id = auth.uid()`),
  SELECT scoped to owner OR `current_vendor_profile_ids()` OR `is_admin()`. Partial unique
  index on (user_id, vendor_profile_id, requested_date) WHERE active makes re-joins
  idempotent; pending (vendor, date) index for the notify hot path. Verified in prod via a
  rolled-back transaction (RLS on + 3 policies present; nothing persisted).
- **Couple** — `/v/[slug]` shows a "Join the waitlist for <date>" CTA when a signed-in
  couple's intended event date is unavailable on the vendor (business-wide closure or a
  Setnayan booking covers it; couples still see only "unavailable"). New
  `joinVendorWaitlist` server action (RLS-checked insert; unique-violation swallowed).
- **Vendor** — Booked-Out Waitlist queue on `/vendor-dashboard/calendar`: pending waiters
  grouped by date with a one-click "A slot opened — notify them" action (`notifyWaitlistSlot`)
  that flips pending → notified, stamps notified_at, and emails each couple.
- **Auto-notify on freed slot** (cron-free) — `removeBlock` snapshots the block's date range
  then fires `notifyWaitlistForFreedRange` via Next 15 `after()` so a removed block emails
  pending waiters for the now-open dates without a poller.
- **Email** — new `sendWaitlistSlotOpenedEmail` at the end of `lib/vendor-email-triggers.ts`
  (plain-text, Resend path, couple contact resolved from `users.email`).

Deferred: admin visibility surface (covered by the SELECT `is_admin()` policy — no dedicated
admin page yet). Couple-side `converted` transition is left for the future booking-conversion
hook.

SPEC IMPACT: None (additive vendor benefit; no SKU/pricing/locked-decision change).
