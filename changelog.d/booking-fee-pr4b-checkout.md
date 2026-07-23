## 2026-07-23 · feat(vendor): Booking Fee PR-4b — the checkout UI (closes the loop)

The vendor-facing fee checkout (`Booking_Fee_Build_Plan §PR-4`). Closes the loop:
a gate-blocked draft now shows a pay-prompt → PayMongo → the webhook settles →
re-send clears. Inert until the fee is enforced (a pending charge only exists then).

- **`lib/booking-fee-checkout.ts`** — pure `bookingFeeInclusiveCentavos(fee, method)`
  (the owner's split: GCash = the fee; card = fee + ₱15 — a single INCLUSIVE price,
  never a surcharge line) + `fetchPendingFeeCharge` (the vendor's own pending charge,
  RLS-scoped). 4/4 tests.
- **`app/proposals/[publicId]/fee-actions.ts`** — `startBookingFeeCheckout`: reads
  the pending charge, computes the inclusive per-method amount, creates a
  method-scoped PayMongo Checkout Session (PR-4a), redirects the vendor to it.
- **`_components/booking-fee-pay-prompt.tsx`** — GCash / card buttons with the
  inclusive prices + a plain "GCash has no added fee, card includes ₱15" line.
- **`proposals/[publicId]/page.tsx`** — on a vendor's DRAFT with a pending charge,
  shows the pay-prompt in place of "Send" (sending is blocked until paid); + fee
  notices (paid / due / failed).

⚠ Unreachable in prod until PayMongo is provisioned + both booking-fee keys are
flipped — a pending charge is only ever created when the fee is enforced. `tsc`
clean. Stacked on PR-4a.

SPEC IMPACT: None new (implements §PR-4 checkout). DECISION_LOG 2026-07-23.
