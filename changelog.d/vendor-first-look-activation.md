## 2026-06-29 · feat(vendors): activate First-Look Window boost + badges (Wave 2)

Activates the already-merged First-Look responsiveness scoring (compat-score
`respondsFast` + `boostWeight`) in the primary marketplace matcher and adds the
couple- and vendor-facing badges.

- **New `apps/web/lib/firstlook.ts`** — defensive reader for the admin-managed
  `platform_settings.firstlook_sla_hours` / `firstlook_boost_weight` (selects ONLY
  those two columns, try/catch, falls back to `{sla 24h, weight 0.10}` on any error
  incl. mid-apply "column does not exist"; deliberately NOT folded into the shared
  `fetchPlatformSettings` SELECT). Plus `isFirstLookEligible()` — the single shared
  gate (replies within SLA AND `response_rate_pct ≥ 70`; the 70% floor is hardcoded
  for now, can later move to admin config).
- **`category-search.ts` matcher** — reads the firstlook config once + batch-fetches
  `vendor_activity_stats` (`avg_response_minutes`, `response_rate_pct`) for the
  candidate set (mirrors `/explore` PR #6 read, warn-on-error fallback), computes
  `respondsFast` per vendor, and passes `respondsFast` + `boostWeight` into
  `computeCompatScore`. Adds `respondsFast` to `CategoryVendorResult` for the UI.
  Boost only ever RAISES a fast responder's score (default weight 0.10; with
  weight 0 it's a byte-for-byte no-op) — never a penalty.
- **Couple-facing "Replies fast" badge** in `category-search-overlay.tsx` (subtle
  green, reuses existing `.badge` token styling).
- **Vendor-facing "First-Look: Earned / At-risk" chip** in `vendor-stats-panel.tsx`
  (Performance header), reading the vendor's own `vendor_activity_stats` vs the
  defensive SLA — same eligibility gate as the matcher, so it's honest.

Other `computeCompatScore` call sites (`build-3state-*`, `plan-budget-accordion`)
are left unchanged this PR (they consume the result type, not construct it) — wiring
them is a low-risk follow-up.

SPEC IMPACT: None (activates an already-spec'd Wave 2 mechanic; no SKU/schema/pricing change).
