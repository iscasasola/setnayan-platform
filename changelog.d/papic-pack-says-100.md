## 2026-09-22 · fix(vendor): the ₱500 pack sells the 100 credits it actually grants

`vendor_billing_catalog.vendor_papic_portfolio_pack` read *"Photo importation fee — 25 Papic
credits for your portfolio (per event)"* from its 2026-09-05 seed. The owner raised what one ₱500
buys to **100** on 2026-09-06 — `VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS = 100` — and the catalogue row
was never touched. Measured in production 2026-09-22: `updated_at` still the seed timestamp, so a
supplier has been told they are buying a **quarter** of what they get.

- Migration `20271239096928` rewrites the title and asserts it landed (a zero-row UPDATE is
  success-shaped). Price stays ₱500; the grant stays 100 and stays in TypeScript.
- 🚨 **A guard was already defending the bug.** `tests/db/vendor-papic-credits-are-the-suppliers.db.test.ts`
  asserted `assert.match(row.title, /25/, 'the title tells the buyer how many credits')` — it pinned
  the stale figure as correct, which is why CI stayed green through a year of it. That assertion now
  reads the LIVE constant, plus a negative for any retired figure.
- The number was *spoken* in **five** places and *used* in one. Two comments in `lib/sku-activation.ts`,
  a test name in `lib/the-fee-reaches-the-allowance.test.ts`, the catalogue title, and fixtures in the
  db guard — all now derive from `VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS` or stop restating it.

🔑 A generous lie raises no support ticket — it errs in the customer's favour, which is why it
survived. And `/admin/pricing` could never have fixed it: `saveVendorRow` writes price, description
and is_active only ("Title stays migration-owned").

SPEC IMPACT: `DECISION_LOG.md` row added 2026-09-22 recording the defect, why an admin edit cannot
reach it, and the re-measure query.
