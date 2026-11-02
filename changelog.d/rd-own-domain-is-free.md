## 2026-10-23 · fix(admin, custom plans): a supplier's own web address is free — the quote can no longer charge for it

The shop page says "Use your own web address… It's free", but the admin Custom-plan composer still offered "Include a custom domain" as a priced line (₱500 unit, `vendor_custom_domain`). Owner: keep it free. The composer drops the toggle, its unit-price field and its summary line; `actions.ts` pins `domain: false` (same pattern as the pinned reach/photo axes). Measured in prod: 0 custom plans exist, so no quote changes.

SPEC IMPACT: None (the free own-domain ruling stands; this removes a contradicting paid line).
