## 2026-07-23 · feat(vendor): booking-fee schedule (pure deterministic core)

The owner-directed vendor Booking Fee, as a pure value→value function — the
"Rule 1" deterministic core every downstream surface computes from. No I/O, no
LLM, no dependencies, so it ships safely ahead of the rest of the (large, gated)
fee system.

- **`lib/booking-fee.ts`** — `bookingFeePhp(proposalPhp)` + `bookingFeeEffectiveRate`
  + `BOOKING_FEE` / `BOOKING_FEE_RATE`. A **single LINEAR rate** (owner 2026-07-23,
  superseding the 2026-07-21 marginal brackets): **₱50 minimum → 1.3333% straight
  line → ₱4,000 locked at ₱300,000**. The rate is fixed by the cap anchor
  (₱4,000 ÷ ₱300,000 = 1.3333%; not 2% — a flat 2% would cap at ₱200k).
- **`lib/booking-fee.test.ts`** — floor/linear-span/cap boundaries + monotonicity
  (₱10k→₱133.33, ₱75k→₱1,000, ₱150k→₱2,000, ₱300k→₱4,000, >₱300k→₱4,000). 8/8 pass.

⚠ This is the fee MATH only, NOT the fee SYSTEM. The ₱4,000 cap **UNIT** is
per-vendor×event (owner 2026-07-23) — enforced in the ledger, not this per-proposal
math. It deliberately does NOT decide the ₱0/barter case (#4, open). The
revenue-critical surface it plugs into (two-sided lock + Proposal Maker + prepaid
send-gate + Maya rail) is unbuilt — see `Booking_Fee_Build_Plan_2026-07-21.md`. Its
first live consumer is the Papic documentation points (`vendorPapicPointsForBookingFee`).

SPEC IMPACT: Records the owner-directed LINEAR fee schedule in code (DECISION_LOG
2026-07-23), superseding the marginal-bracket schedule in
`3D_Plan_and_Vendor_Revenue_Model_2026-07-20.md` §3.0. The "0% commission" claim in
Pricing.md / CLAUDE.md / AS_BUILT_GROUND_TRUTH is contradicted by this fee and still
needs owner reconciliation (unchanged by this PR).
