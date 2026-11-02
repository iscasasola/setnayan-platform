## 2026-07-05 · fix(vendor): resolve verification fees from service_catalog (retired ₱1,500/₱2,500 → Free)

Vendor verification went FREE via the `20260702000000_v2_retire_v1_skus_and_setnayan_pay.sql`
migration (renewal + re-verification SKU rows set `is_active = FALSE`), but the
app still stamped and displayed the retired ₱1,500 / ₱2,500 fees. New applications
were being born with fees that no longer exist (Entity Map & Hardcode Audit
2026-07-04, Violation #1).

- `lib/vendor-verification.ts`: replaced the hardcoded `APPLICATION_FEE_CENTAVOS`
  and price-baked `APPLICATION_TYPE_LABEL` with:
  - `resolveApplicationFeeCentavos(supabase, type)` — reads the fee from
    `service_catalog` at draft-insert time; an **inactive OR missing** SKU row
    (and any non-positive `price_centavos`) resolves to **₱0**. Fails open to 0.
  - `APPLICATION_TYPE_SKU` — the CHECK-bound type → `sku_code` map (kept in code,
    lock-step key space; only the *fee* is DB-resolved).
  - pure `feeLabelForCentavos()` (₱0 → "Free") + `applicationTypeLabel()`.
- 3 insert sites now stamp the resolved fee: `app/vendor-dashboard/verify/actions.ts`,
  `app/vendor-dashboard/shop/inline-docs-actions.ts`, `app/open-shop/actions.ts`.
- 5 UI fee labels now build from the same lookup (₱0 renders "Free"):
  `app/vendor-dashboard/verify/page.tsx` (intro line, start-application card,
  status meta), `app/_components/verification/application-progress.tsx`,
  `app/admin/verify/page.tsx` (application card label + fee, demoted-vendor card).
- Added `lib/vendor-verification.test.ts` — pins the pure "0 means Free" rule,
  the label builder, and the canonical SKU key space.

Behaviour change (owner-flagged): `annual_renewal` and `post_demotion`
applications now stamp **₱0** while their SKUs stay retired — matches the live
"verification is free" state; no draft can be born with a retired fee again.

SPEC IMPACT: None. Aligns code to the already-shipped 20260702 retirement
migration; catalog/pricing corpus already reflects free verification.
