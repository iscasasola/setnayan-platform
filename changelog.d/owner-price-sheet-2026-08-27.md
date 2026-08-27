## 2026-08-27 · feat(pricing): the owner's price sheet — three customer prices, six vendor prices, Event Hub Pro, and two retirements

Every number below is an owner ruling given on 2026-08-27 and applied exactly as
given. Nothing was rounded, smoothed or "improved" on the way in.

**Customer catalog (`platform_retail_catalog_v2`)**

- `PAPIC_GUEST_50K` ₱10,000 → **₱11,200**
- `LIVE_STUDIO` ₱2,999 → **₱3,000**
- `PAPIC_ADDON_THANK_YOU` ₱2,499 → **₱2,500**
- `COUPLE_WEBSITE_PRO` title *"Couple Website PRO"* → **"Event Hub Pro"**. Price
  unchanged at ₱3,500, `service_code` unchanged. The catalog row was the last
  place still carrying the old name — the corpus and several rendered surfaces
  had said Event Hub Pro for weeks.

⚖ The 50K rung **shallows** the ladder's discount at the top (80% → 77.6%) rather
than deepening it. That is his call. Both rules the ladder guard actually
enforces still hold — never above ₱1 a credit, never worse per credit than the
rung below (₱0.224 vs 30,000's ₱0.25) — so **no guard was weakened**; one pinned
expectation in `apps/web/tests/db/papic-ladder.expected.ts` moved with the price,
and the guard was mutation-checked RED at the old value before and green after.

🔒 Unchanged, each ruled on: the other fifteen Papic rungs · `SETNAYAN_AI`
(₱2,499 / ₱1,499 onboarding) · `CUSTOM_QR_GUEST` at ₱0.

**Customer bundles (`platform_package_catalog`) — RETIRED**

- `PAPIC_UNLOCK` "Unlock all of Papic" ₱15,000 → off sale
- `PAPIC_UNLOCK_LTD` "Unlock all of Papic (Ltd)" ₱9,000 → off sale

Superseded by the sixteen-rung ladder: with 50,000 credits at ₱11,200, a ₱15,000
"unlock everything" package no longer prices sensibly beside it. Measured before
writing, not assumed — production holds **two orders in its entire life** and
neither is a bundle, and `event_software_activations_v2` holds **zero** rows for
either code, so nothing is stranded and no live entitlement is stripped.
`is_active` is honoured at every layer that renders or charges a bundle
(`fetchV2BundleCatalog`, `resolveBundleChargeCentavos`, `resolveServiceSellability`,
and the Papic studio buy card, which compares the flag rather than merely
selecting it) — checked rather than assumed. The retirement reason lives in the
migration comment because this table has no reason columns on this branch.

**Vendor catalog (`vendor_billing_catalog`)**

- `enterprise_vendor_monthly` ₱8,000 → **₱10,000**
- `solo_vendor_annual` ₱10,000 → **₱10,400**
- `pro_vendor_annual` ₱25,000 → **₱26,000**
- `enterprise_vendor_annual` ₱80,000 → **₱104,000**
- `vendor_additional_branch` ₱999 → **₱1,000**
- `vendor_3d_booth` ₱1,500 → **₱2,500**

🔢 Every annual figure he gave is exactly `four_week_price × 10.4` (thirteen
28-day periods, 20% off). Verified on each. **Recorded as an observation in the
migration comment, never encoded** — a stored second copy of a pricing rule is
how prices drift, and he must stay free to break it on any single row.

**Vendor Custom tier — RETIRED, all six purchasable rows**

`vendor_custom_base` ₱8,999 · `vendor_custom_reach_nationwide` ₱2,499 ·
`vendor_custom_domain` ₱499 · `vendor_custom_event_slot` ₱499 ·
`vendor_custom_reach_step` ₱499 · `vendor_custom_photo_pack` ₱99.
Owner: **Enterprise becomes the top purchasable tier**; anything above its caps
is handled by hand, off-platform.

🔒 `vendor_tier_rank()` and the `vendor_tier_state` enum are **untouched** —
retiring what can be BOUGHT is the ruling, deleting the tier concept is not.
Read out of production: the function ranks every enum value explicitly and its
`ELSE` arm fails closed; production holds two vendor profiles and **both are
`solo`**, so no vendor's rank can move.

🚨 **AND THE FLAG DOES NOT CLOSE THE CUSTOM DOOR — reported, not silently
half-fixed.** `lib/vendor-custom-catalog.ts` reads these rows with
`.eq('is_active', true)` and substitutes a hardcoded literal for any row that
goes missing; its own docblock says deactivating a row *"is not a retirement"*
and that the axis *"keeps quoting, at the same price, with the catalog saying it
is off."* The vendor-side Custom configurator is still linked from the
subscription page and still quotes the same figures. Closing it for real means
deleting the axes from `CUSTOM_SKU_CODES` and `CUSTOM_UNIT_PRICE_FALLBACK` — a
separate change, surfaced to the owner rather than smuggled in here. What this
migration *does* achieve customer-side: `/vendors` and the homepage read through
`fetchV2VendorCatalog`, which filters `is_active`, and `customFrom` has no peso
fallback by design — so the public "from ₱8,999" figure disappears on apply.

**Deliberately NOT done**

- The four **annual add-on rows** the sheet asks for (branch ₱10,400 · seat
  ₱2,600 · Vendor AI ₱15,600 · 3D Booth ₱26,000) were **not created.** The
  billing machinery cannot charge or honour an annual add-on: every add-on term
  is a hardcoded 28 (`BRANCH_PERIOD_DAYS`, `SEAT_PERIOD_DAYS`,
  `VENDOR_AI_ADDON_PERIOD_DAYS`, `VENDOR_3D_BOOTH_PERIOD_DAYS`), each price
  reader selects one literal `sku_code`, and the only function that turns
  `subscription_annual` into a 365-day term — `create_vendor_subscription` —
  maps sku→tier by `LIKE 'solo|pro|enterprise_vendor_%'` and raises
  `UNMAPPED_SKU_TIER` for anything else. A priced row nothing can fulfil is the
  "takes the money and grants nothing" shape this repo keeps paying for.
- `vendor_photo_challenge` — the sheet prices it ₱2,500/4wk + ₱26,000/yr, which
  is a change of **selling model** (per-event → recurring), not a price.
- `vendor_branch_28day` stays at ₱999 while its twin `vendor_additional_branch`
  moves to ₱1,000. That inconsistency is deliberate, and it is now a *visible*
  one: the twin is what the **public pages quote** and the other is what
  **actually charges**.

SPEC IMPACT: `Pricing.md` § 00 and `DECISION_LOG.md` (2026-08-27 row) updated
directly in the corpus at `~/Documents/Claude/Projects/Setnayan/`, together with
`Vendor_Monetization_Model_LOCKED_2026-07-25.md` and
`apps/web/VENDOR_TIERS_AND_BENEFITS.md`, which both documented Custom as a live
tier and now record it as retired 2026-08-27 with Enterprise as the top
purchasable tier. The historical description is marked retired, not deleted.
