## 2026-06-29 · feat(vendor): Demand Radar (Wave 6 vendor "Soon" benefit)

Ships Demand Radar end-to-end — a first-party, de-identified read of couple
demand that tells a vendor which months / areas / looks are heating up, without
ever exposing a single couple.

- **Migration `20270324631500_demand_radar_rollups`** — a materialized
  `demand_radar_rollups` table keyed by `(region, month_bucket, event_type,
  style)` → `inquiry_count` (chat_threads) + `unlock_count` (vendor_event_unlocks,
  the paid-to-answer demand proxy) + `booking_count` (event_vendors committed:
  contracted+). RLS at CREATE with **zero policies** (direct client reads denied;
  the only door is the read fns). Three SECURITY DEFINER fns: `refresh_demand_
  radar_rollups()` (cron-free full rebuild, admin/service_role gated),
  `demand_radar_for_vendor(uuid)` (owner-gated, scoped to the caller's own
  hq_region), `demand_radar_admin()` (is_console_admin gated, all markets). Every
  surfaced bucket clears `public.min_n_ok(total, platform_settings.radar_min_n_
  floor)` — small cells suppressed; the floor is admin-managed + COALESCE-defended
  to 1. Output is counts only — no user_id, event_id, names, or identifiable plan.
- **`apps/web/lib/demand-radar.ts`** — assembles the radar (month heat, top
  regions, hot looks, event types) from the read fns; honest empty/suppressed
  state (never fabricates); cron-free recompute via `refreshDemandRadar()` (admin
  "Run now") + throttled `maybeRefreshDemandRadar()` (Next 15 `after()` piggyback,
  mirrors lib/spotlight-awards.ts).
- **Vendor surface** `/vendor-dashboard/demand` — a "where to focus" card for the
  vendor's own market (owner/admin only, like Payday/Earnings) + one sidebar nav
  entry in the Grow group.
- **Admin surface** `/admin/demand` — fuller dashboard across all regions/types
  with a min-N-floor + feed-toggle readout and a "Run now" button.

Founder-only marketplace today → most cells are below the floor and suppressed,
which is expected and rendered honestly.

SPEC IMPACT: None — additive vendor-benefit surface; no SKU, pricing, schema-
rename, or locked-decision change. Reuses the Wave 2 `min_n_ok` substrate +
`platform_settings.radar_min_n_floor` / `radar_enabled` admin-managed config.
