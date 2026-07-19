## 2026-07-11 · feat(venue): show the couple's walk-through entrance on the public guest walk

Follow-up to #3060 (door↔walk-through entrance). The couple could choose a
walk-through ("tunnel") entrance in the 2D editor / 3D lab, but the PUBLIC guest
venue walk always rendered a plain door because the `public_venue_scene` RPC
didn't carry `entrance_kind` / `entrance_depth_m`.

- **Migration `20270718464682_public_venue_scene_v7_entrance_kind.sql`** — recreates
  the public RPC adding `'kind', fp.entrance_kind` + `'depthM', fp.entrance_depth_m`
  to the `floor.entrance` jsonb. Byte-identical to the v6 (vendor-event-scope)
  definition except those two keys (verified by diff) — so the v6 booth→vendor
  same-event join constraint is preserved. Idempotent `CREATE OR REPLACE`,
  signature + SECURITY DEFINER unchanged.
- **`guest-venue-3d.tsx`** — the public loaders already spread the RPC payload
  wholesale, so `scene.floor.entrance.kind/depthM` now arrive with no loader
  change. Added the door/tunnel STRUCTURE to the guest walk (it previously drew
  no entrance structure), mirroring the 3D lab: a door renders a shallow frame
  slab; a walk-through renders two inward side walls + a lintel via
  `coldSparkFrame` (clamped so it never crosses the far wall). Gated on
  `entrance.enabled` (a disabled entrance draws nothing). Refreshed the now-stale
  "payload doesn't carry kind" comment; the `?? 'door'` / `?? 3` defaults stay as
  a fallback for older / cached payloads.

Verify: `tsc --noEmit` clean; `next lint` clean; seating tests 102/102;
`migration:check` 717 unique. (No booted-app visual check — app can't boot
locally; geometry mirrors the shipped, visually-reviewed lab block from #3060.)

SPEC IMPACT: None (completes shipped behavior — the public walk now reflects the
entrance kind the couple already designs; no product-surface/pricing change).
