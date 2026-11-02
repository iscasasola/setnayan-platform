## 2026-07-24 · feat(booking-fee): collect 5% at LOCK via the QR rail + free-5 (dark)

Closes the vendor money loop — DARK behind the existing booking-fee flags
(`NEXT_PUBLIC_BOOKING_FEE_ENABLED`, default OFF). Nothing charges a real vendor
until the owner flips it; main is byte-behaviour-identical today.

**Trigger moved SEND → LOCK.** The owner moved the fee trigger to the vendor
LOCK (`finalizeVendor` → `event_vendors` reaching `contracted`), base = the
COUPLE-CONFIRMED agreed total (`event_vendors.total_cost_php` — the enforcement
anchor). The inert proposal-SEND gate (`bookingFeeSendGate`, guarded by
`isBookingFeeEnforced()` at 3 sites in `proposals/actions.ts` +
`proposal-send.ts`) is RETIRED to guarantee a SINGLE trigger — leaving it would
double-charge once the rail flag flips. Byte-identical today (it was inert); the
dormant `bookingFeeSendGate` library is left unremoved.

**Free-5.** A verified vendor's (marketplace-linked / DTI+permit reg-number
identity) first 5 booked customers pay nothing; booking 6+ pays 5%. The ordinal
is FROZEN on `booking_fee_ledger` at first charge (per-vendor advisory lock
serialises concurrent first-locks), so a re-lock never double-counts or shifts a
vendor across the 5/6 boundary. Off-platform vendors (no `marketplace_vendor_id`)
are never billed.

**Mechanics** (migration `20270927120000`): reprices `booking_fee_centavos` to
flat 5% / NO cap (it had drifted to the superseded 2%/₱4,000-cap; inert until now
so the reprice is safe); adds a LOCK-sourced charge (nullable `proposal_id`, an
`event_vendor_id` anchor, `source`, `waived_free5` status) + the
`booking_fee_open_lock_charge` RPC. On the 6th+ lock the RPC opens a `pending`
charge and `collectBookingFeeAtLock` issues a vendor-payer `orders` row
(`service_key = vendor_booking_fee__{chargeId}`, VAT-inclusive, `SN`+hex ref) on
the existing manual GCash/BDO rail — idempotent per (vendor×event). **Settle
bridge** (the missing connection — the ledger had ZERO settle callers): a
`vendor_booking_fee__` PREFIX_HOOK in `sku-activation` calls
`settleBookingFeeCharge` when the admin approves the order to `paid`, rolling the
charge into the ledger (idempotent).

Free-5 counts LOCK ledger rows minted while the fee system is live (fresh
counter, not retroactive) — the money-safe choice over live-`event_vendors`
counting, which un-lock/re-lock could shake. Tests: `booking-fee-lock.test.ts`
(12/12 — service-key round-trip, 5th-vs-6th boundary, flag-off no-op, fee base,
₱0/barter) + `booking-fee-lock.db.test.ts` (6/6 on full replay — schedule,
free-5→6th, idempotent re-lock, off-platform skip, non-contracted skip, settle +
double-settle no-op).

FOLLOW-UPS (flagged, NOT built): (1) post-lock AMENDMENT fee adjustment — if the
agreed price changes via an accepted change-order/amendment after lock, the fee
should re-derive (the high-water column exists; delta-billing is unwired). (2) a
dedicated vendor-facing fee-order pay surface + notification (today the fee order
lands in `/admin/payments` and reconciles on the existing path).

SPEC IMPACT: None — implements the owner's 2026-07-24 fee-at-lock direction; the
5%/no-cap schedule + LOCK trigger already reflect `lib/booking-fee.ts` +
`DECISION_LOG` and no locked SKU/price/schema decision is changed.
