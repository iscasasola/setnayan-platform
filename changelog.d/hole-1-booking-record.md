## 2026-11-16 · fix(db): a couple cannot forge a booking record (HOLE 1)

`event_vendors_couple_write` is FOR ALL with no column list, and nothing guarded WHO a booking is with, HOW it came
about, or a row born finished. A couple's own session could insert a 'complete' booking with another shop, which
the public finished-jobs count (`vendor_public_completed_events_stats`) and the Booked Loop badge
(`shop_booked_loop_count`) counted. It could also repoint a typed row onto another shop, or relabel a Setnayan-sourced
booking as the supplier's own invite, which makes `booking_fee_attribution_for` return 'import' (free).

- Migration `20271349022603_a_couple_cannot_forge_a_booking_record.sql` adds one guard trigger,
  `guard_event_vendor_provenance`. It writes no data and leaves RLS unchanged. For authenticated/anon writers only:
  - `source` is never a supplier-brought value (vendor_invite · vendor_locked_qr · reuse_accept), and it may be
    filled when empty but never rewritten;
  - `marketplace_vendor_id` never moves;
  - `linked_vendor_profile_id` is NULL or the row's own shop;
  - a shop row is never born delivered/complete and never written 'complete' directly.
  SECURITY DEFINER RPCs and the service role are exempt, as with `guard_event_vendor_lock_handshake`.
- Every couple-session writer in apps/web was mapped first. The guard does not refuse a couple's own 'contracted'
  booking without a supplier yes: with the lock handshake flag off, that is the shipped booking path.
- 🔒 `tests/db/hole-1-a-couple-cannot-forge-a-booking-record.db.test.ts` is #7841's proof with each HOLE OPEN assertion
  flipped to CLOSED, plus the real flows still working. With the migration removed, the 3 CLOSED tests go red and the
  3 STILL WORKS tests stay green.

SPEC IMPACT: None.
