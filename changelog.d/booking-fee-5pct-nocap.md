## 2026-07-24 · pricing(booking-fee): flat 5%, ₱50 floor, NO cap

Reprice the vendor booking-fee schedule from "flat 2%, ₱50 floor, ₱4,000 cap"
(2026-07-23) to flat 5%, ₱50 floor, no cap (owner-directed 2026-07-24).
`bookingFeePhp` drops the ₱4,000 clamp; `BOOKING_FEE.rate` 0.02 → 0.05;
`BOOKING_FEE.capPhp` removed. Floor now binds ≤₱1,000 (5% × 1,000 = 50).
Worked: ₱10k→₱500 · ₱100k→₱5,000 · ₱1M→₱50,000 (was capped at ₱4,000).
Tests rewritten (cap cases → unbounded-linear cases). Pure value→value core;
downstream booking-fee-charge / booking-fee-gate / vendorPapicPointsForBookingFee
consume the new values unchanged.

SPEC IMPACT: Pricing.md / AS_BUILT booking-fee references (2% / ₱4,000 cap) are now
stale → 5% / no-cap. Owner was flagged that no-cap re-opens the large-ticket
under-declaration incentive and accepted the trade; enforcement relies on
couple-confirmation + verified-median. Corpus DECISION_LOG + revenue-model doc
updated in the same session by the main agent.
