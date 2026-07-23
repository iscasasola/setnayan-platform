## 2026-07-23 · refactor(vendor): Booking-Fee gate — rail-agnostic enforce flag (PayMongo)

Owner chose **PayMongo** as the payment rail (2026-07-23, superseding Maya). The
send-gate's two-key enforcement previously keyed the "rail live" half on
`NEXT_PUBLIC_MAYA_STATUS === 'APPROVED'` — which PayMongo never sets, so it would
have kept the gate inert against the wrong rail. Decoupled it.

- **`lib/booking-fee-gate.ts`** — `isBookingFeeEnforced()` now = flag ON AND
  `NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE`. Rail-agnostic: the owner flips one flag once
  the rail is KYC-approved AND the checkout (PR-4) is wired, regardless of gateway.
- Test updated (6/6). Still inert — `RAIL_LIVE` defaults off, so enforcement stays
  asleep exactly as before.

SPEC IMPACT: Resolves booking-fee rail sign-off #6 → PayMongo (DECISION_LOG
2026-07-23). PR-4 checkout will be a PayMongo integration (dormant until owner KYC
+ keys + webhook secret).
