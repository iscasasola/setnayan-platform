## 2026-06-22 · feat(vendors): link the booking to its contract (spawn, status, sign-back)

Closes a flywheel gap: the couple's per-event vendor BOOKING ledger
(`event_vendors`) and the CONTRACTS feature (`vendor_contracts`) ran as parallel,
disconnected subsystems. A contract keyed off `(event_id, vendor_profile_id)` with
no link back to the booking, so a booking could never show "does this vendor have a
contract, and how far along is it?".

**event_vendors.status decision — do NOT flip it.** The task asked whether to flip
the booking to `status = 'contracted'` on sign. We did NOT. `'contracted'` is
already a load-bearing value of the LOCKED `vendor_status` state machine — it's
written by `finalizeVendor()` the moment the couple BOOKS a vendor (a soft hold,
booked-but-unpaid) and gates the hard-single conflict guard
(`vendors/actions.ts:536`), the per-date soft-hold limit
(`vendors/actions.ts:936`), the schedule-pool "white vs locked" capacity doctrine
(`lib/schedule-pools.ts`), and the plan-locked UI set (`vendors/page.tsx:723`). By
the time a contract is signed the booking is typically already at `'contracted'` or
beyond (`'deposit_paid'`/`'delivered'`), so writing `'contracted'` back would be a
no-op at best and a DESTRUCTIVE DOWNGRADE at worst (e.g. dropping `'deposit_paid'`
back, corrupting the soft-hold count + schedule-pool occupancy). Per the owner rule
("never rename/repurpose `event_vendors.status`"), contract progress is surfaced as
an ORTHOGONAL derived marker, never a status transition.

What landed:

- **Migration `20270217864104_contract_booking_link.sql`** (applied to prod
  statement-by-statement via `supabase db query` + manual ledger row, since
  `db push` hit the known parallel-session ledger drift):
  - `vendor_contracts.event_vendor_id` — nullable FK → `event_vendors(vendor_id)`,
    `ON DELETE SET NULL`, partial index, backfilled by matching
    `event_id + marketplace_vendor_id`.
  - `event_vendors.contract_signed_at` — derived marker (orthogonal to `status`),
    stamped when a linked contract reaches a signed/active state.
  - `resolve_event_vendor_for_contract(event, vendor_profile)` resolver fn.
  - `vendor_contract_sync_booking()` trigger on `vendor_contracts` (AFTER
    INSERT/UPDATE OF status, event_vendor_id, …) — maintains `contract_signed_at`;
    sets it on active, clears it on cancel (only when no other linked contract is
    still active). This is the "on sign → mark the booking" wiring; it works for
    the forward-compat `fully_signed` path AND the current upload-only
    `sent_for_signature` ("visible to couple") state.

- **Resolve + populate on create** — `uploadVendorContract`
  (`app/vendor-dashboard/contracts/actions.ts`) now resolves the matching booking
  and stamps `event_vendor_id` on insert, with graceful-degrade: RPC → direct query
  → null, and a `42703` retry-without-the-column so an unmigrated prod never breaks
  upload.

- **Booking shows its contract** — the couple's service workspace
  (`app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx`) Documents header
  now shows a derived `No contract yet / awaiting signature / signed` badge
  (`deriveBookingContractState` in `lib/contracts.ts`), linking to the contract.

- **Booking → contract** — the vendor's per-client event brief
  (`app/vendor-dashboard/clients/[eventId]/page.tsx`) gets a "Create a contract" CTA
  that deep-links to `/vendor-dashboard/contracts/new?event=<id>` (pre-filling the
  couple; the new-contract page now honors `?event=` only when that event is in the
  vendor's thread-derived option list). The couple side, which can't upload, gets an
  "Ask {vendor} for a contract" prompt that deep-links to the chat thread.

SPEC IMPACT: 0006 vendors / 0032 contracts — a booking can now spawn a contract,
shows its contract status, and a signed/active contract marks the booking — without
touching the locked `event_vendors.status` enum. Logged in `DECISION_LOG.md`.
