## 2026-07-23 · refactor(live-studio): rename ROAM foundation off `panood_*` → `live_studio_roam_*`

The product is **Live Studio**, with two variants: **Live Studio Cast** and
**Live Studio Roam** (owner 2026-07-23). The Roam foundation had followed the
legacy `panood_*` internal namespace; since it's brand-new + flag-dark (nothing
depends on it), this renames it to the real product name while it's free.

- **Migration `20270919193341_live_studio_roam_rename.sql`** — the `panood_roam_*`
  tables (empty, flag-dark) are dropped and recreated as `live_studio_roam_zones`
  / `live_studio_roam_channel_pool` / `live_studio_roam_streams`, and
  `events.panood_roam_manifest` → `events.live_studio_roam_manifest`. Clean names
  throughout (indexes, policies, constraints).
- **Files renamed:** `lib/panood-roam.ts` → `lib/live-studio-roam.ts`,
  `lib/panood-roam-provision.ts` → `lib/live-studio-roam-provision.ts` (+ tests).
- **Flag renamed:** `NEXT_PUBLIC_PANOOD_ROAM_ENABLED` →
  `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` (was never set anywhere → safe).
- **Identifiers:** `panoodRoamEnabled` → `liveStudioRoamEnabled`;
  `PanoodRoamZoneStatus`/`PANOOD_ROAM_ZONE_STATUSES` → `RoamZoneStatus`/`ROAM_ZONE_STATUSES`.
- Event-page wiring updated to the new module/flag.

SCOPE: ROAM only. The legacy **Cast** internal names (`panood_broadcasts`,
`panood_camera_operators`, `PANOOD_SYSTEM`, `lib/panood-youtube.ts`, …) are
deliberately unchanged — renaming a live, selling product's schema + SKU key is a
separate, larger effort. The `live_studio_roam_zones.camera_operator_id` FK still
references the legacy `panood_camera_operators` table by its real name.

SPEC IMPACT: `Live_Studio_Cast_and_Roam_2026-07-23.md` + memory updated to the `live_studio_roam_*` names (2026-07-23).
