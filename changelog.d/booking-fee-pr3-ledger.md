## 2026-07-23 · feat(vendor): Booking Fee PR-3 — fee ledger + charge tables + money RPCs

The prepaid-gate data spine (`Booking_Fee_Build_Plan §PR-3`). Ships **inert**: the
tables/RPCs exist but nothing writes to them until the send-action wiring lands AND
`NEXT_PUBLIC_BOOKING_FEE_ENABLED` is flipped. No money moves.

- **Migration `20270916909942`**
  - `public.booking_fee_centavos(amount_centavos)` — the authoritative SQL fee
    schedule (flat 2%, floor ₱50, cap ₱4,000; mirror of `lib/booking-fee.ts`).
  - `booking_fee_ledger` — one row per `(vendor_profile_id, event_id)` = the ₱4,000
    cap unit (owner 2026-07-23). Mirrors `vendor_event_unlocks`: SELECT-only RLS for
    the owning vendor + admin; writes via service-role RPCs. High-water column
    nullable, **no** delta-billing (that rule's still open).
  - `booking_fee_charges` — one row per proposal SEND attempt; partial-unique so a
    proposal is billed at most once. Status set has **no** `void`/`refunded`
    (no-refund-on-walkaway resolved 2026-07-22).
  - RPCs (service-role only): `booking_fee_open_charge` (resolves the fee
    authoritatively, upserts the ledger, opens/reuses one live charge; import or
    cap-reached → free), `booking_fee_settle_charge` (pending→paid + rolls into the
    ledger, idempotent), `booking_fee_proposal_cleared` (the read-only send-gate
    predicate).
- **`lib/booking-fee-charge.ts`** — `isBookingFeeEnabled()` (default off),
  `BOOKING_FEE_SCHEDULE_VERSION`, and typed wrappers over the RPCs. Nothing calls
  them yet (that's PR-3b, the send-gate wiring).

⚠ Reuses the EXISTING `vendor_proposals` table (the Proposal Maker already ships) —
the 2026-07-21 brief's "build the proposal object" is already done. Charge collection
needs a live Maya rail (owner KYC) — PR-4. `tsc` clean; migration doctor healthy.

SPEC IMPACT: None new (implements the specced §PR-3). DECISION_LOG 2026-07-23.
