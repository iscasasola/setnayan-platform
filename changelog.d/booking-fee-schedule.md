## 2026-07-23 · feat(vendor): booking-fee schedule (pure deterministic core)

The owner-locked (2026-07-21) vendor Booking Fee, as a pure value→value function —
the "Rule 1" deterministic core every downstream surface computes from. No I/O, no
LLM, no dependencies, so it ships safely ahead of the rest of the (large, gated)
fee system.

- **`lib/booking-fee.ts`** — `bookingFeePhp(proposalPhp)` + `bookingFeeEffectiveRate`
  + `BOOKING_FEE` constants. Marginal tax-style brackets on the finalized proposal
  amount: ₱50 flat to ₱2,500 · 2.0% to ₱50k · 1.5% to ₱150k · 1.0% to ₱300k ·
  ₱4,000 cap above. Continuous everywhere; effective rate 2.00%→0.40%.
- **`lib/booking-fee.test.ts`** — the build brief's exact boundary table
  (2,500→₱50, 2,501→₱50.02, 50k→₱1,000, 150k→₱2,500, 300k→₱4,000, >300k→₱4,000)
  + model-doc worked examples + monotonicity (8/8 pass).

⚠ This is the fee MATH only, NOT the fee SYSTEM. Deliberately does NOT decide: the
₱4,000 cap UNIT (#3c-unit, a ledger concern — open sign-off), or the ₱0/barter case
(#4, open). The revenue-critical surface it plugs into (two-sided lock + Proposal
Maker + prepaid send-gate + Maya payment rail) is unbuilt — see
`Booking_Fee_Build_Plan_2026-07-21.md`. Its first live consumer is the Papic
documentation points (`vendorPapicPointsForBookingFee`).

SPEC IMPACT: Records the owner-locked fee schedule in code (DECISION_LOG 2026-07-23).
The "0% commission" claim in Pricing.md / CLAUDE.md / AS_BUILT_GROUND_TRUTH is now
contradicted by this fee and still needs owner reconciliation (unchanged by this PR).
