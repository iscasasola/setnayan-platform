# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-22 · fix(money): council fixes — vendor-pricing money-integrity / activation / security-scoping

A review council found money-integrity, activation, and security-scoping defects in
the just-shipped vendor-pricing build (Vendor AI / 3D Booth / Photo Challenge /
Deep Search add-ons + the vendor-enabled couple 3D-Plan discount). None changed
any price; they close leaks and re-lock entitlements.

- **H1 — ₱1,000 3D-Plan discount was permanent + free.** The charge-time resolver
  (`lib/v2-catalog.ts resolvePaxPricedOrderCentavos`) applied the discount whenever
  an `event_vendor_3d_plan_unlocks` row merely EXISTED. New
  `eventVendor3dPlanUnlockDiscountActive` (`lib/vendor-3d-plan-unlock.ts`)
  RE-VALIDATES the attributing vendor at charge time — the record exists AND the
  vendor still has a live 3D Booth add-on (`isVendor3dBoothActive`) AND is still
  booked (`event_vendors` contracted+). A lapsed booth / un-booked / cancelled
  vendor now yields the STANDARD ₱2,999; the `Math.min` lower-only guard is kept;
  reads fail-safe toward the standard price.
- **H2 — refund/reject kept the feature.** `deactivateOrderSku`
  (`lib/sku-activation.ts`) now reverses `vendor_ai_addon` + `vendor_3d_booth`
  (expire the `*_addon_expires_at` window this order stamped — never a later-stacked
  cycle, via the pure `resolveAddonDeactivationExpiry` in
  `lib/vendor-addon-deactivation.ts`) and `vendor_photo_challenge` (delete the
  `papic_photo_challenge_sponsorships` row). `vendor_deep_search` is already-consumed
  → no reversal.
- **H3 — Deep Search free-run race.** The buy action was read-decide-run (count →
  ₱0 → run → write the use AFTER), so concurrent requests all ran free. Now the
  action CLAIMS the free run atomically FIRST (insert the `vendor_deep_search_uses`
  row before running); a partial unique index
  `(vendor_profile_id, free_cycle_start) WHERE was_free` (migration
  `20270912537338`) serializes a burst — the winner runs, the losers re-price to
  ₱500. `runAndRecordVendorDeepSearch` gains a `claimUseId` (update the pre-claimed
  row, not a second insert); a failed run rolls the claim back.
- **H4 — paid Deep Search charged for a keyless Lite pass.** With no
  `ANTHROPIC_API_KEY` the engine silently degrades to the free Lite result; the
  paid buy now BLOCKS (no order created, nothing charged) via
  `deepSearchAiConfigured`. The free Lite path still works at ₱0.
- **H5 — a failed paid activation was invisible.** `activateOrderSku` +
  `deactivateOrderSku` + the best-effort provisioning hooks now
  `Sentry.captureException` (tagged with order_id + service_key) on any hook
  failure, so a paid-but-unentitled order is alertable, not console-only.
- **M1 — Photo Challenge double-charge.** Added a pending-`submitted`-order guard
  (mirrors the couple-3D buy) so two quick submits can't mint two ₱400 orders.
- **M2 — add-ons lapsed with no warning.** The AI/Booth activation hooks (+ the free
  first-cycle orders) now stamp `orders.expires_at`, and `productTitleFor` names
  them, so the renewal-reminder job includes AI/Booth windows.
- **M3 — Deep Search paid activation ran synchronously in the admin Approve click.**
  `approvePayment` now defers the `vendor_deep_search` activation to `after()` so
  approval returns fast and a timeout can't strand a re-clickable half-run.
- **S1 — unscoped role check.** All 5 buy/unlock actions (ai-addon, booth-addon,
  deep-search, photo-challenge, vendor-3d-plan-unlock) resolved the user's
  GLOBAL-highest vendor role, then acted on a specific `vendorProfileId`. New
  `resolveVendorRoleForProfile` scopes owner/admin to the exact profile.
- **S2 — hardened activation hooks.** The vendor add-on hooks re-assert
  tier + verification on the paying vendor at activation time (defence in depth for
  the latent comp/self-comp bypass).
- **Privacy — Deep Search dossier retention.** New cron-free 180-day TTL sweep
  (`lib/vendor-dossier-retention.ts`, fired from admin-layout `after()` behind a
  weekly `claim_periodic_job`) purges old `vendor_web_dossiers`. The `/privacy`
  legal notice is untouched (owner/DPO-owned).

Tests: added coverage for the discount re-validation (pure + fake-client), the
add-on deactivation decision, and the Deep Search claim/update path
(`lib/vendor-3d-plan-unlock.test.ts`, `lib/vendor-addon-deactivation.test.ts`,
`lib/vendor-deep-search-run.test.ts`). Full `lib/**` unit suite + `tsc --noEmit`
green.

SPEC IMPACT: None — money-integrity / activation / security hardening on the
shipped vendor-pricing build; no new product surface, no price change, no SKU
change. One additive migration (`20270912537338`) adds
`vendor_deep_search_uses.free_cycle_start` + a partial unique index.
