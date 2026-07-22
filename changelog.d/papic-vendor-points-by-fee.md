## 2026-07-22 · feat(papic): fee-scaled vendor documentation points + retire the token-earned tier

Owner 2026-07-22 redefined the vendor Papic documentation allowance: the 50-point
grant is the free **gift** floor, and it now **scales with the booking fee the
vendor paid** — 50 pts at ₱0, up to **200 pts at a ₱4,000 fee**, linear in between
("goes smaller in proportion to the amount they paid for").

- **`lib/vendor-papic-tier.ts`** — new pure `vendorPapicPointsForBookingFee(feePhp)`
  (50 → 200, capped, junk-fee-safe) + `VENDOR_PAPIC_BASE_GIFT_POINTS` /
  `_MAX_POINTS` / `_FEE_CEILING_PHP`. ⚠ INPUT PENDING — the booking-fee mechanism
  is still a working doc; the formula is encoded + tested, ready to wire the moment
  the fee exists (a 0 fee yields the floor, so wiring it early is a no-op).
- **🚫 Tokens retired (owner 2026-07-21)** — dropped the dead `tokens_burned` /
  `lead_token_holds` reads from the tier derivation (`vendor-papic-grants.ts`,
  `VendorAcceptProvenance`). The interim ladder is now: founder-comp → Ltd (the
  only non-token bump), any other booked accept → Lite (the 50-pt gift), admin
  comp → Unli. Zero prod behaviour change (0 tokens ever existed); the fee-scaled
  formula supersedes the Lite/Ltd ladder once the fee lands.
- Tier + grants unit suites updated (25/25 pass), incl. new fee-formula coverage.

SPEC IMPACT: Pricing.md / DECISION_LOG — vendor Papic documentation is a
fee-scaled gift (50→200 pts by booking fee), not a token-earned tier. Recorded in
DECISION_LOG 2026-07-22. Whole lane still DPO-gated (`vendor_papic_capture` OFF).
