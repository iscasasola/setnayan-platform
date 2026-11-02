## 2026-07-22 · feat(vendor): 3D Booth add-on — ₱1,500/28d branded virtual booth (free first cycle), entitlement-gated render

A new sellable, per-vendor-entitled add-on that turns ON a **branded virtual
booth** inside the vendor's couples' **published 3D Plans** (the guest venue walk
`/[slug]/venue` + the couple's own 3D lab). Owner-locked 2026-07-22: **₱1,500 /
28-day**, on **Pro / Enterprise / Custom** (verified) — **FREE for the vendor's
FIRST 28-day cycle** (one-time per account). Mirrors the Vendor AI add-on's
billing/trial substrate exactly. It is **Pro+** (not Solo+ like the AI add-on)
because booth branding is already a Pro/Enterprise perk (`boothCanBrand`).

- **Migration** `20270908863003_vendor_3d_booth_sku_and_trial.sql`: seeds the
  admin-managed `vendor_3d_booth` SKU (₱1,500, `vendor_addon_recurring`,
  display_order 85; `ON CONFLICT` never stomps an admin price edit); adds
  `vendor_profiles.booth_addon_trial_used_at` + `booth_addon_expires_at`
  (mirrors the AI-addon columns). Idempotent; reuses the existing
  `vendor_addon_recurring` offering_type (no CHECK change). No new table → no new
  RLS.
- **Resolver** `lib/vendor-3d-booth-pricing.ts` (sibling of `vendor-addon-pricing.ts`):
  pure `resolveVendor3dBoothPricePhp({trialUsed,cyclePricePhp})` (₱0 first / ₱1,500
  after · catalog price wins, ₱1,500 fallback), `isVendor3dBoothActive(expiresAt)`,
  `nextVendor3dBoothExpiry(...)`, `fetchVendor3dBoothPricePhp` / `fetchVendor3dBoothState`.
  Unit-tested (`vendor-3d-booth-pricing.test.ts`, 13 cases).
- **Purchase action** `app/vendor-dashboard/subscription/booth-addon-actions.ts`:
  Pro+/verified gate rejected BEFORE pricing (`isTierAtLeast(tier,'pro')`), re-reads
  the ₱1,500 authoritative price + `is_active` from the catalog. Free first cycle →
  atomic claim (`UPDATE … WHERE booth_addon_trial_used_at IS NULL`) + direct-activate
  + ₱0 audit order. Paid cycle → apply-then-pay order+payment → `/admin/payments` →
  `sku-activation` hook stamps the 28-day window.
- **sku-activation hook** (`lib/sku-activation.ts`): `vendor_3d_booth` →
  `activateVendor3dBoothOrder` stamps `booth_addon_expires_at` (stacking from the
  later of now / current expiry), idempotent via a prior `service_activated` ledger row.
- **Entitlement-gated the booth render** — the decision boundary is
  `lib/seating-3d.ts`: new `BoothVendor.boothAddonActive?: boolean` + new pure
  `boothIsBranded(vendor)` = `boothCanBrand(vendor.tier) && vendor.boothAddonActive === true`.
  The four render call sites (`venue-objects.tsx` BoothMesh logo + poster,
  `booth-template.tsx` nameboard, `booth-templates.ts` poster avoidance disc) now
  gate on `boothIsBranded` instead of the tier-only `boothCanBrand`. A Pro vendor
  WITHOUT the add-on = the existing generic booth. `boothAddonActive` is resolved
  server-side via `isVendor3dBoothActive(booth_addon_expires_at)` in `fetchBooths`
  (`lib/seating.ts`) and carried into the couple lab + the guest venue scene
  (`/[slug]/venue/page.tsx` fetchBooths enrichment). Gate unit-tested
  (`booth-branding-gate.test.ts`).
- **NOT gated** (deliberate, reported): the homepage 3D demo (`plan3d-demo-actions.ts`)
  and the vendor's OWN booth showcase preview (`/v/[slug]/booth`) set
  `boothAddonActive: true` — illustrative/preview surfaces, not a real couple's
  published plan; this preserves their byte-identical current rendering.
- **UI** `_components/booth-addon-card.tsx` on the subscription hub (mirrors the AI-addon
  card): not-eligible / free-first-cycle / active+renew states, "Free first cycle,
  then ₱1,500/28d".

**DEFERRED — needs owner design sign-off (NOT built):** the add-on's stretch
"unlimited sponsored activations" (a vendor publishing a couple's 3D Plan on the
couple's behalf). It gives away the couple's ₱2,999 `SEATING_3D` value an
unbounded number of times — real render cost + abuse implications (a vendor
force-publishing plans, or farming free 3D plans) — and it is cross-cutting into
the couple publish flow. Only the branded-booth entitlement core shipped here.

SPEC IMPACT: New vendor SKU `vendor_3d_booth` (₱1,500/28d, Pro/Enterprise/Custom,
free first cycle) + two `vendor_profiles` columns. Corpus follow-up (owner to
apply in `~/Documents/Claude/Projects/Setnayan/` — this PR is worktree-scoped to
code): append a `DECISION_LOG.md` row and extend the vendor add-on set
(AI ₱1,500 + Photo Challenge ₱400 → + 3D Booth ₱1,500). The stretch "unlimited
sponsored activations" piece is flagged as pending owner sign-off (cost/abuse
bounds) and is NOT built or specced as shipped.
