## 2026-06-26 · feat(guest-3d): guest venue explorer route + Sims-style read-only scene

Owner direction ("guests enjoy this too", Sims-style — confirmed). The visual
layer on top of the verified public_venue_scene data path (#2218): a public
`/[slug]/venue` route + a self-contained read-only WebGL scene.

- **`app/[slug]/venue/page.tsx`** — public, no session. Calls the SECURITY
  DEFINER `public_venue_scene` RPC server-side (`?t=` = the guest's personal
  token, which surfaces their own seat); unpublished/unknown → a friendly
  "not ready yet" state. force-dynamic.
- **`_components/guest-venue-loader.tsx`** — `dynamic(ssr:false)` loader (WebGL
  needs the browser), same pattern as the lab + veil reveal.
- **`_components/guest-venue-3d.tsx`** — a NEW read-only scene (no editor
  coupling, so zero risk to the working lab): room + tables + chairs + ANONYMISED
  occupancy tokens + the guest's own seat glowing. Their avatar **auto-walks from
  the entrance to their seat on open, then TAP-TO-ROAM** lets them walk anywhere —
  pathfinding around tables/stage via the unit-tested steerPath/floorObstacles.
  HUD shows their table + tablemates (only when they came via their personal link).

Self-contained + built on tested primitives; the visual FEEL is the preview call.
Venue-object meshes + palette theming + PRO gate are follow-ups. Default warm
palette for now.

SPEC IMPACT: 0008 Seating + 0031 Day-of guest — guests get a 3D venue explorer.
