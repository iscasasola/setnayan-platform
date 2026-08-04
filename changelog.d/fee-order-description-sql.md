## 2026-07-27 · fix(booking-fee): derive the AMENDMENT-path order description from the schedule (SQL twin)

The SQL half of the defect the TS side just closed. `public.booking_fee_upsert_vendor_order`
— the vendor-order minter used on the AMENDMENT path, where a DB trigger fires and
no TypeScript is in the loop — hard-coded

```
Setnayan booking fee (5%) — amended booking, up for verification within 24 hrs
```

Verified against the LIVE database: the deployed function body still contains that
literal, and `20270930120000_booking_fee_rederive_on_amendment.sql` is the live
definition. Since the 2026-07-25 taper (5% on the first ₱100,000, then 1%, floor
₱50, no cap) that claim is only true at or below ₱100,000 — an amended booking of
₱1,000,000 is billed ₱14,000 = **1.40%** on a document asserting 5%.

- `supabase/migrations/20271013349208_booking_fee_schedule_summary_in_sql_order_description.sql`
  (new) — adds `public.booking_fee_schedule_summary()` (`RETURNS TEXT`, `IMMUTABLE`,
  `LANGUAGE sql`, `REVOKE`d from `PUBLIC`/`anon`/`authenticated`, `EXECUTE` to
  `service_role`), the SQL mirror of `bookingFeeScheduleSummary()`; then
  `CREATE OR REPLACE`s `booking_fee_upsert_vendor_order` with a body reproduced
  verbatim from `20270930120000` except that the description now COMPOSES that
  summary. Comment + grants re-issued so the migration is self-contained. A
  post-condition `DO` block refuses to apply if the function still hardcodes the
  rate or does not call the summary. The already-applied `20270930120000` is NOT
  edited — that would be drift, not a fix.
- `apps/web/tests/db/booking-fee-rederive.db.test.ts` — the anti-drift guard, mirroring
  the existing `booking_fee_is_sourced_surface` vs `SOURCED_INQUIRY_SOURCES` parity
  test: calls `public.booking_fee_schedule_summary()` in the replayed-migration
  harness and `bookingFeeScheduleSummary()` in TS and asserts the strings are
  IDENTICAL. SQL cannot import `BOOKING_FEE`, so the sentence is duplicated by
  necessity; on the next reprice the TS side moves (it is derived), the SQL literal
  does not, and this fails loudly instead of shipping another wrong bill. A second
  test drives the real MINT branch (no seeded order → the trigger's SQL minter
  writes the document) on a ₱1,000,000 amendment and asserts the description
  contains no bare `(5%)` and does state the real schedule.

The fee MATH is untouched: no change to `booking_fee_centavos`, `bookingFeePhp`,
`BOOKING_FEE_SCHEDULE_VERSION`, the re-derive core, or the trigger. Copy only.
`apps/web/lib/booking-fee.ts` is depended on but not modified (it belongs to the
stacked PR beneath this one).

Noted, NOT changed here (a positioning decision with the owner, not an engineering
one): the vendor-facing and public marketing copy still advertising a "flat 5%" in
`apps/web/app/vendor-dashboard/booking-fees/page.tsx` and
`apps/web/app/vendors/_components/vendor-grow-sections.tsx`.

SPEC IMPACT: None (copy only; the taper math is unchanged)
