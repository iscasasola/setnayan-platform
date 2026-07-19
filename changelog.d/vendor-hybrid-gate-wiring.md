## 2026-07-01 · feat(vendor-tiers): wire hybrid feature gates (flag-dark)

Turned the top of the hybrid code-owed gate list (VENDOR_TIERS_AND_BENEFITS.md
§5) into real entitlement enforcement — so the premium-few surfaces actually
gate to their tier instead of rendering for every free vendor:

- `lib/vendor-tier-caps.ts` — three new caps on all five tiers, monotonic:
  `marketIntel` (Pro+), `theftWatch` (Pro+), `performanceTrends` (Solo+), with
  `canSeeMarketIntel` / `canSeeTheftWatch` / `canSeePerformanceTrends` helpers.
- `lib/vendor-feature-gate.ts` (new) — `isVendorFeatureGateEnabled()` (env
  `VENDOR_TIER_FEATURE_GATE`) + `resolveVendorTier()` (a targeted `tier_state`
  read; deliberately NOT added to the shared `FULL_VENDOR_PROFILE_SELECT`, so
  the gate stays additive).
- `app/vendor-dashboard/_components/tier-gate.tsx` (new) — shared `VendorTierGate`
  upsell panel: names the feature, restates its value, links to
  `/vendor-dashboard/subscription`. Shown in place of the surface (not a silent
  redirect) when gated.
- Enforced at three surfaces: `/vendor-dashboard/demand` → Pro, `.../theft-watch`
  → Pro, `.../funnel` → Solo. The demand gate piggybacks `tier_state` on the
  page's existing `hq_region` read (no extra round-trip).

FLAG-DARK BY DESIGN: the flag defaults OFF, mirroring `vendor-search-gate.ts`.
Today the one founder vendor + every demo/test vendor are `tier_state='free'`;
activating gates now would lock them out of surfaces they use. Behaviour is
unchanged until the owner sets `VENDOR_TIER_FEATURE_GATE=true` in prod once paid
vendors exist — flipping that one env var activates all three gates at once. The
`canSee*` cap helpers stay pure/always-correct; only the page enforcement is
flag-guarded, so any surface can adopt the gate the same way.

SPEC IMPACT: In-repo SSOT `apps/web/VENDOR_TIERS_AND_BENEFITS.md` §5 updated
(gates-wired handoff + what's still owed to the dashboard/admin session). No DB
schema/SKU/price change. Corpus decision-log row added via authorized direct-edit.
