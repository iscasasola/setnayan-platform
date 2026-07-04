# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(marketing): free-forward /pricing + /for-vendors redesign + frosted-glass nav popups

Front-end / marketing-only redesign of the customer **/pricing** page, the vendor **/for-vendors** page, and their two floating-nav popups (Prices · Vendors). No checkout, payment, entitlement, Papic-engine, or migration code touched. Every price stays sourced from the live catalog — nothing hardcoded.

### /pricing (`apps/web/app/pricing/page.tsx`)
Rebuilt to the free-forward structure: cinematic hero → **Free · Explore (₱0) vs Setnayan AI** → **add-ons GROUPED** ("Papic & its add-ons" · "Go live & interactive" · "Your website" · "Personal touches", each Papic add-on tagged **"with Papic"**) → a **client-side, display-only Papic estimator** → the complete **"Free, always"** list → the **apply-then-pay / 0%-commission** line.
- Prices read live via `fetchV2CustomerCatalog`, `formatSkuPriceLabel`, `formatPeso`, `formatBillingPeriodSuffix` (`lib/v2-catalog.ts`), plus a direct `SETNAYAN_AI_RENEW` read for the ₱799 renewal (same pattern as before). Setnayan AI intro/period from the active `SETNAYAN_AI` row.
- Add-on groups are DATA-DRIVEN: each row resolves its SKU by `service_code`; a missing/inactive SKU is **omitted, never hardcoded**. `WEBSITE_UPGRADE` is gated to show only when present in the catalog. The two per-camera Papic rate SKUs (`PAPIC_CAMERA_ROLL_DAY` / `PAPIC_CAMERA_UNLIMITED_DAY`) collapse into one "Papic Cameras · from ₱30/camera" row; the raw rows stay in the JSON-LD @graph.
- Build-status chips (Live / In build / Coming soon) preserved. Empty-catalog state renders a polite "loading" card. The pricing JSON-LD @graph is preserved.

### Papic estimator (`apps/web/app/pricing/_papic-estimator.tsx`, new)
Client component. Tier pick (Ltd/Unli), cameras + days steppers, add-on checklist, live total capped at ₱15,000/day → beyond the cap it locks as "Unlimited + all boosters included". **Display only — no server calls, no checkout.** Ltd/Unli rates + add-on prices come from the catalog (props from the server page); ₱30/₱100/₱15,000 are graceful fallbacks only.

### /for-vendors (`apps/web/app/for-vendors/page.tsx` + `_components/vendor-benefit-guide.tsx`, new)
Added the **full ~90-benefit guide, filterable by tier** (All / Free / Solo / Pro / Enterprise / Coming soon) after the existing free-forward hero → free-offering → tier-delta ladder (`VendorTierLadder`, already shipped). Content pulled entirely from the canonical `VENDOR_TIER_SECTIONS` / `VENDOR_CUSTOM_TIER` (`app/_components/home/vendor-benefits.ts`, in step with `VENDOR_TIERS_AND_BENEFITS.md`) — no invented benefits, `soon` markers preserved. Tier price tags come from `getVendorPrices` (DB), never hardcoded. Closes with the 0%-commission / merit-only trust strip.

### Frosted-glass nav popups (`apps/web/app/_components/home/HomeOverlays.tsx` + `home-reskin.css`)
`PricesOverlay` + `VendorsOverlay` slimmed to ONLY the free offering + ONE line-link out ("Want more features? → See all prices" / "Want to upgrade your business? → See vendor plans"). Both now render in a translucent **frosted-glass card** (`hr-ov-card-glass`) matching the nav's `blur(16px) saturate(1.3)` exactly (not a heavier blur). They no longer depend on resolved pricing, so they open instantly. Removed the in-popup tier ladder, live estimator, and full benefit ladder (that content now lives on the full pages). Guest Stories deliberately excluded from the free list (it is paid/inactive). The opaque Download / Sign-in / demo overlays are untouched.

SPEC IMPACT: None. Marketing-surface presentation only — no SKU, price, tier, schema, or catalog changes. All prices remain admin-managed via the live catalog (`platform_retail_catalog_v2` / `vendor_billing_catalog`).
