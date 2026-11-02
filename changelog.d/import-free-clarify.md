## 2026-07-01 · docs(vendor): correct stale "customer import is token-gated" comments — import is FREE both directions

Owner clarified the canonical model (2026-07-01): **customer import is FREE in
both directions** —
1. **Vendor → customer via QR** — `/vendor-invite/[slug]` (#2449): a vendor
   shows/sends an invite QR, the couple scans → joins as a real client. Free
   (#2448 retired the 1-token import fee).
2. **Customer → vendor** — a couple adding/inviting a new vendor into their
   shortlist (`createVendor`, `source='host_manual'`) is also free; the vendor is
   rendered/added at no token cost.

Behavior was already correct (`createVendor` does a plain `event_vendors` insert,
no gate; `importCustomerTokenCost: 0` for all tiers; user-facing copy already
reads "Client imported — free"). Only two internal **code comments** still claimed
the old token-gate:

- `_components/home/vendor-benefits.ts` — the NOTE said the vendor "direct invite
  QR" *doesn't exist* and customer import is *token-gated (1 token)* — both false
  now. Rewritten to the bidirectional-free model; flagged that neither is surfaced
  as a `VENDOR_HERO_CARD` yet (promotion pending owner sign-off on framing).
- `lib/vendor-tier-caps.ts` — the `canBuyTokens` rationale ("FREE buys tokens to
  import clients · 1 token/import") is stale; import is free, so a FREE vendor now
  has **no token sink at all**. Comment corrected; the owner-locked "FREE may buy"
  override is kept, but its import justification no longer applies.

SPEC IMPACT: None (comment-only; no schema/logic/UI change — the live behavior and
user-facing copy were already free). Open product question flagged to owner: since
FREE has no token sink, revisit whether FREE should still be able to buy tokens.
