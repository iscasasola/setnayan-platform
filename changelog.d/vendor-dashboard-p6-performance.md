## 2026-07-01 · feat(vendor-dashboard): My Performance cockpit (Phase 6)

Standalone `/vendor-dashboard/performance` route — the landing for the
"My Performance" nav group (previously only Demand Radar + Funnel links). It
composes the already-shipped analytics surfaces and adds two net-new panels,
owner/admin only (it surfaces booking revenue; `performance` is absent from
`VENDOR_SCOPED_NAV_ITEM_KEYS` and the page re-checks `canManageVendor()`).

- **App-vs-Import ROI attribution** — how much booked business Setnayan sourced
  (marketplace search + auto-cascade up-sell) vs. business the couple brought in
  off-platform (manually added). Derived from the existing
  `event_vendors.source` + `total_cost_php` columns via a new SECURITY DEFINER
  RPC `public.vendor_source_attribution(p_vendor_profile_id, p_since)`
  (ownership-gated to `current_vendor_profile_ids()` — `event_vendors` has no
  vendor-facing SELECT policy). Peso figures are labeled honestly as partial:
  `total_cost_php` is nullable and vendors settle payment off-platform, so the
  panel never fabricates a revenue number for unpriced bookings.
- **Vendor-safe business-health composite** — five pillars (Responsiveness,
  Reliability, Reputation, Profile strength, Ranking signal) averaged from the
  vendor's own `vendor_activity_stats` row. The HQ-internal
  `platform_health_score` is NEVER read or surfaced.
- Composes the detailed `VendorStatsPanel` (moved out of Home) plus drill-down
  links to Demand Radar + Funnel.
- Home's inline stats panel is replaced with a one-tap "My Performance" pointer
  card so every metric surface has one canonical home.
- New nav item `performance` (Gauge icon) at the top of the My Performance group;
  `/more` descriptions added for performance/demand/funnel.

Migration: `20270404069507_vendor_source_attribution_rpc.sql` (idempotent,
CREATE OR REPLACE FUNCTION only — no new table/column; `source` +
`total_cost_php` already exist).

SPEC IMPACT: None. Additive analytics surface built entirely on shipped schema
(`event_vendors.source`/`total_cost_php`, `vendor_activity_stats`). No pricing,
SKU, entitlement, or taxonomy change. The vendor-dashboard build-plan already
anticipated the standalone Performance page joining the My Performance group
(vendor-sidebar.tsx header comment).
