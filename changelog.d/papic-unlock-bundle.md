## 2026-06-26 · feat(papic): "Papic Unlock All" ₱15,000 bundle + Kwento becomes a paid SKU

A new Papic add-on bundle, **PAPIC_UNLOCK ₱15,000** (`platform_package_catalog`),
that grants every Papic add-on PLUS free, **uncapped Unli cameras** — the hard
ceiling on a couple's Papic spend (à-la-carte the add-ons + a maxed Unli camera
spend run higher).

The hard part was the camera allowance: a per-camera Unli camera is a *provisioned
seat* gated per-camera by payment, not a single entitlement. Owner-locked design
(2026-06-26): owning PAPIC_UNLOCK is treated as **"all Unli cameras paid"** — the
per-camera capture gate bypasses the paid-gate for Unli-tier seats when the event
owns the bundle, and couples self-provision Unli cameras for free. Uncapped per
owner (truly unlimited Unli cameras).

Kwento was a non-SKU (no `service_code`, no gate). To bundle it, **Kwento becomes
a real paid SKU** (`KWENTO` ₱1,499, provisional). Owner-locked rollout is
**NEW EVENTS ONLY**: every event existing at the 2026-06-27 cutover is
grandfathered free (`events.kwento_free_grandfathered`); newer events need the
KWENTO entitlement (direct, or via a bundle e.g. PAPIC_UNLOCK).

- **Migrations** (NOT auto-applied — owner runs `supabase db push`):
  - `20270303532523_papic_unlock_and_kwento_catalog.sql` — PAPIC_UNLOCK package
    row · KWENTO retail row · `events.kwento_free_grandfathered` column +
    re-run-safe backfill (fixed cutover literal).
  - `20270303726391_papic_unlock_bundle_aware.sql` — `bundles_granting_sku()`
    CREATE OR REPLACE with the third bundle's 6 children.
- **Entitlement mirrors (all 3 in sync, lint-enforced):** `BUNDLE_CHILD_SKUS`
  (entitlements.ts) · `BUNDLE_MEMBERS.papicUnlock` (onboarding-pricing.ts) ·
  `bundles_granting_sku()` (migration). `lint-entitlement-gates.mjs` generalized
  from 2 → 3 bundles and now reads the NEWEST migration defining the function.
- **Capture-gate bypass:** new `papicUnliUnlockAllActive()` (papic-cameras.ts)
  ORed into the per-camera paid-gate in `app/papic/actions.ts` +
  `app/api/upload/route.ts` (Unli tier only; bundle-aware + refund-aware).
- **Free Unli provisioning:** `provisionUnlockUnliCameras` server action
  (studio/papic) — gated on owning PAPIC_UNLOCK, per-submit bound 250 (uncapped
  overall), seats stamped to the paid bundle order for traceability.
- **Buy surface:** `UnlockAllCard` on the Papic studio page — buy drawer at the
  live bundle price when unowned, free-Unli provisioner when owned.
- **Kwento paywall:** server gate at `POST /api/papic/kwento` (grandfathered OR
  `eventSkuActive(KWENTO)`, fail-OPEN) + client composer hide via a new
  `kwentoEnabled` prop on the guest capture component.
- **Activation:** `PAPIC_UNLOCK` → `activateBundleChildren` (sku-activation.ts).
- Tests: 7 new entitlement cases (PAPIC_UNLOCK grants/active/submitted/nesting).

⚠ OWNER SIGN-OFF FLAGGED (load-bearing): (1) KWENTO ₱1,499 is PROVISIONAL — set
in `/admin/pricing` at the holistic pass. (2) Making Kwento paid reverses the
locked "every service free to use" positioning — mitigated to new-events-only so
no current couple loses it. (3) ₱15,000 vs à-la-carte: the 5 priceable add-ons
sum to ≈₱9,995; the headline "save vs à-la-carte" copy depends on the Unli spend
counted — left as provisional pricing.

SPEC IMPACT: New PAPIC_UNLOCK ₱15,000 bundle + KWENTO ₱1,499 SKU + Kwento
new-events-only paywall. Logged at the bottom of corpus `DECISION_LOG.md`
(2026-06-26). Pricing rows are admin-managed; figures provisional pending the
holistic pricing pass.
