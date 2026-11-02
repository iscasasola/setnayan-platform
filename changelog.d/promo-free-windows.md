## 2026-07-22 · feat(admin/pricing): Free windows — admin-scheduled "these services are free this weekend" announcements

Owner ask (2026-07-22): "on admin on the pricing … create announcements when we
want to provide free paid services at a certain date for vendors and users for
their events." Ships **both audiences** — couples and vendors — flag-dark.

**Couples — entitlement-OR, not a ₱0 order.** A live `promo_free_windows` row
(is_active AND now within `[starts_at, ends_at)`) makes its `covered_service_keys`
resolve as OWNED for every couple during the window, ORed into `eventSkuActive`,
`eventOwnsSku`, and the batch `eventActiveSkus` in `lib/entitlements.ts` — exactly
like `comp_grants` / `founder_seats`, but audience-wide and **ephemeral** (the
unlock reverts when the window closes unless the couple separately bought the
SKU). This is the right shape because the inline checkout **hard-requires a
payment screenshot**, so a ₱0 order can't flow through it — "free" has to be an
entitlement, not a zero-peso purchase. No order row, no BIR receipt (a free promo
has none). The buy-CTA `eventOwnsSku` OR means a couple is never charged for
something that is free this moment; the Studio grid shows covered SKUs as
included.

**Vendors — a tier PROMOTION, not a ₱0 subscription.** Vendor SKUs carry a DB
`CHECK (price_php > 0)`, so vendor "free" can't be a zero-peso plan. Instead a live
`audience_type='all_vendors'` window names a `promoted_vendor_tier`
(solo/pro/enterprise); `resolveVendorTier` — the ONE feature-tier choke point all 7
vendor gates read — upgrades every vendor to it for free during the window, never a
downgrade (`applyVendorTierPromotion` compares `tierRank`). All 7 callers are
feature gates (theft-watch, recaps, earnings, creators, performance, calls, help
routing), so the promotion is exactly the tier they should see; billing surfaces
read `vendor_subscriptions` directly and are untouched. ⚠ Also inert until paid
vendor billing is switched on (`VENDOR_TIER_FEATURE_GATE`) — before that every
vendor already has every feature, so a "free tier" window is a no-op; it's wired
for the day that flips.

**Surfaces.** New migration `20270908268882_promo_free_windows` (table + RLS at
create time — admin-only; server reads via the service-role client). New reader
`lib/promo-free-windows.ts` (flag-gated, `cache()`d, graceful-degrade to empty).
New admin tab **Catalog Studio → Free windows** (`/admin/pricing?tab=free-windows`)
to author/activate/deactivate/delete windows, pick the covered couple SKUs from
the live catalog (couple form) OR pick a vendor tier (vendor form), and set a
PH-time date range (`_surfaces/free-windows-{surface,actions}.tsx` · every write
audit-logged). Two in-app banners mounted once each — couple
(`promo-free-window-banner.tsx`, event layout) + vendor
(`promo-free-window-banner-vendor.tsx`, vendor-dashboard layout), both self-gating
to null when nothing is live — the announcement channel the owner picked.

**Gated OFF by env `PROMO_FREE_WINDOWS_ENABLED` (default off).** While off, every
reader short-circuits before touching the DB, so entitlements + layout are
byte-identical to today (verified: all 71 `entitlements.test.ts` cases pass
unchanged). Belt-and-suspenders over `is_active` + the date window, per the
migrations-auto-apply rule (a go-live hold is a flag shipped OFF, not "hold the
push"). The owner flips it the day a promo should go live.

**Scope / known edges (V1):**
- **Both audiences ship** (couples + vendors). `segment` (targeted filters) stays
  schema-forward and unused.
- **Vendor path is inert until paid billing is on** (`VENDOR_TIER_FEATURE_GATE`) —
  see above.
- **Standard-entitlement SKUs only.** SKUs gated purely by `eventSkuActive`/
  `eventOwnsSku` (Animated Monogram, 3D Plan, Editorial PRO, …) go free cleanly.
  Bespoke-metered SKUs (Papic per-camera day quotas, guest credit caps) read
  their own order-specific gates and are NOT lifted by a promo window in V1.
- **Ephemeral, not claim-to-keep.** Matches "silent auto-free". Minting a real
  comp grant on first use during a window (so the couple keeps it) is a deliberate
  follow-up, not V1.

SPEC IMPACT: New admin capability + a new "free-service promo" concept that
composes the existing comp-grant/entitlement model (couples) and the vendor
feature-tier model (vendors). Logged as `DECISION_LOG.md` rows (entitlement-OR for
couples, tier-promotion for vendors, flag-dark, ephemeral). No locked-decision
change — commission stays 0%, pricing tables unchanged; this is an admin lever over
existing SKUs/tiers. Owner sign-off flagged in the PR for the ephemeral-vs-claim
decision.
