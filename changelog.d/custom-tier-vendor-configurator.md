## 2026-07-04 · feat(vendor-dashboard): Custom-tier "Compose a Custom plan" configurator (PR-B)

Vendor-facing Custom-tier composer + "Beyond Enterprise?" entry on the
subscription page (owner's "custom button on subscription" · stacked on the
PR-A schema/libs).

- New sub-route `/vendor-dashboard/subscription/custom` (server page reads the
  9 per-unit prices from the admin-managed `vendor_billing_catalog` via the new
  `lib/vendor-custom-catalog.ts` and passes them to a client configurator).
- `_components/custom-configurator.tsx`: 7 controls (branches · reach stepper
  100→500 km + Nationwide toggle · team seats · event slots/category · portfolio
  photos · included tokens/cycle · custom domain). Live 28-day + annual quote via
  the SAME `lib/vendor-custom-pricing.computeCustomQuote` (no reimplementation),
  per-line breakdown, floor note. No discount control (admin-only · PR-C).
- "Beyond Enterprise? Compose a Custom plan." entry card added to the
  subscription page below the tier ladder, routing to the sub-route.
- Submit = "Request this plan" → apply-then-pay: upserts a `vendor_custom_plans`
  row (status `pending_payment`, `quoted_28d_php` = server-recomputed `final28`)
  + an `orders` row keyed `vendor_custom_plan__{vendorProfileId}` (status
  `submitted`, `SN`+8hex ref) + a pending `payments` row — mirrors `buyExtraSeat`
  exactly, so it lands in `/admin/payments` for review. Guard: verified stores
  only (not tier-gated — it's a sales path). Amount is re-priced server-side from
  the catalog; the client price is never trusted.
- If the vendor already runs Custom with an ACTIVE plan, its composition shows
  read-only with an "Adjust" affordance that composes a NEW pending plan (never
  mutates the active row the effective-caps overlay reads).
- `lib/v2-catalog.ts`: widened `V2VendorSku.offering_type` to include
  `branch | seat | custom_addon` (all already returned by the unfiltered read).

SPEC IMPACT: None — implements VENDOR_TIERS_AND_BENEFITS.md §11.
