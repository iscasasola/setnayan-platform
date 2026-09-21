## 2026-09-22 · fix(vendor): the ₱500 pack sells the 100 credits it actually grants

`vendor_billing_catalog.vendor_papic_portfolio_pack` read *"Photo importation fee — 25 Papic
credits for your portfolio (per event)"* from its 2026-09-05 seed. The owner raised what one ₱500
buys to **100** on 2026-09-06 — `VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS = 100` — and the catalogue row
was never touched. Measured in production 2026-09-22: `updated_at` still the seed timestamp, so a
supplier has been told they are buying a **quarter** of what they get.

- Migration `20271239096928` rewrites the title and asserts it landed (a zero-row UPDATE is
  success-shaped). Price stays ₱500; the grant stays 100 and stays in TypeScript.
- New guard `tests/db/the-pack-sells-what-it-grants.db.test.ts` reads the LIVE constant and asserts
  the title quotes it, plus a negative for any retired figure. Verified by sabotage: reverting the
  migration to 25 turns 2 of its 3 cases red with the real message.

🔑 A generous lie raises no support ticket — it errs in the customer's favour, which is why it
survived. And `/admin/pricing` could never have fixed it: `saveVendorRow` writes price, description
and is_active only ("Title stays migration-owned").

SPEC IMPACT: `DECISION_LOG.md` row added 2026-09-22 recording the defect, why an admin edit cannot
reach it, and the re-measure query.
