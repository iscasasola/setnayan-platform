## 2026-07-02 · feat(vendor): service-card redesign Phase 3b — bracket/inclusion/discount list editors

Repeatable LIST editors for a vendor service card, wired into both the inline-edit
and create forms on `/vendor-dashboard/services`:

- **New** `apps/web/app/vendor-dashboard/services/_components/service-list-editors.tsx`
  exporting three client editors that render index-aligned HIDDEN inputs the
  server action reads via `formData.getAll(…)`:
  - `InclusionsEditor` — FREE items `{label, worth_php?}` → `inclusion_label[]` · `inclusion_worth[]`.
  - `DiscountsEditor` — multi-discount `{type, rate, unit(%/₱), expires_at?, conditions_md?}`
    → `discount_type[]` · `discount_rate[]` · `discount_unit[]` · `discount_expires_at[]` ·
    `discount_conditions_md[]`. Replaces the single-discount `DiscountFields`.
    Preserves the Off-Season nudge (seeds one `off_peak` row when arrived via `?offpeak`).
  - `PriceBracketsEditor` — Fixed-basis pax tiers `{min_pax?, max_pax?, price_php}`
    → `bracket_min_pax[]` · `bracket_max_pax[]` · `bracket_price[]`. Shown ONLY for
    the Fixed basis (threaded through `PricingBasisEditor`'s new `fixedExtra` slot,
    so its inputs are unmounted for per-pax/per-hour).
- `actions.ts` `createVendorService` + `updateVendorService`: parse the repeated
  inputs (`parseDiscountRows` / `parseInclusionRows` / `parseBracketRows`) and
  replace-all (DELETE by service+profile, INSERT) into the three child tables via
  a shared `replaceServiceLists` helper — mirroring the prior single-discount
  replace-all. For Fixed basis WITH brackets, `starting_price_php` = lowest bracket
  price (the Explore/budget anchor reflects the tiers). Validation: rate>0, type in
  enum, unit in (pct,php), promo requires expiry, inclusion label 1–80 / worth ≥0,
  bracket price ≥0 / max≥min; fully-blank rows ignored.
- `lib/vendor-services.ts`: added `fetchInclusionsByService` + `fetchBracketsByService`
  (+ `VendorServiceInclusion` / `VendorServicePriceBracket` row types), mirroring
  `fetchDiscountsByService`. Fail-soft to empty maps.
- `services-manager.tsx`: batched the three child-list fetches; `DiscountBadge` now
  shows the first discount with its unit (% / ₱) + a `+N` when there are more.
  Removed the now-dead `DiscountFields` / `DISCOUNT_TYPE_HELPS`.

The guided-wizard path (`commitVendorService` + `save_vendor_service` RPC) still
passes `p_brackets`/`p_inclusions` = `[]`; wiring the wizard is deferred (the two
inline actions were prioritized per the task scope).

SPEC IMPACT: None — activates the Phase-1 child-table schema (migration 20270502342558:
`vendor_service_price_brackets` / `vendor_service_inclusions` / `vendor_service_discounts`).
No new schema, no migration.
