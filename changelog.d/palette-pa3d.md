## 2026-06-27 · feat(pa3d): wire mood-board role_palette as canonical Pa3D scene material source

- Added `resolvePaletteFromRoles(rp: RolePalette): Lab3DPalette` in `lib/seating-3d.ts`
- Maps `events.role_palette.reception[]` → five 3D material slots: `accent` (stage/highlights) · `table` (linen) · `floor` (carpet) · `wall` (backdrop) · `ambient` (light tint)
- Couple's 3D seating lab now uses `events.role_palette` as the "Mood board" palette instead of the stale `event_moodboard_saves` snapshot
- Guest venue explorer (`/[slug]/venue`) fetches `events.role_palette` and applies the same mapping — guests see venue colours that match the couple's mood board
- Avatar attire colours (gown/suit) were already role-palette-driven; this extends to all scene surfaces

SPEC IMPACT: `0008_seating` — Pa3D free tier scene materials now driven by `events.role_palette` (canonical mood-board source). No schema changes.
