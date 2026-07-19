## 2026-07-08 · feat(papic): Live Photo Wall — couple-configurable photo count + tile layout

The Salamisim wall projected a fixed masonry collage (48 tiles, one look). Owner 2026-07-08
(D5): the couple now sets **how many photos** the wall shows (6–60) and picks the **tile
layout** — mosaic (the original masonry · default) · grid · hero (big newest + strip) ·
polaroid (scattered tilted cards). Fully responsive; **no resolution field** (the wall fills
whatever screen it's cast to).

- **Migration** `20270522000000_papic_wall_config.sql`: `events.wall_photo_count` (default 40)
  + `events.wall_tile_layout` (default `'mosaic'`, CHECK `grid|mosaic|hero|polaroid`). Default
  mosaic → **existing walls are unchanged**. New columns inherit events' RLS.
- **`lib/live-wall-logic.ts`**: `WallTileLayout` type + `asWallTileLayout` / `clampWallPhotoCount`
  sanitizers (pure, shared client + server).
- **`wall-projection.tsx`**: reads `photoCount` (caps the DOM) + `tileLayout` (a `TileGrid`
  switch, 4 variants; the newest-tile reveal animation preserved in each).
- **Studio Live Wall card + P3 `/live` console**: a "Wall display" config block (count input +
  layout picker + Save) wired to a new **membership-gated** `saveWallConfig` action (admin write,
  inputs clamped/sanitized so a bad value can't violate the CHECK constraints).

Verify: `tsc --noEmit` → 0 new errors (2 pre-existing are unrelated vendor files). The 4 layouts
are CSS/responsive — visual review happens on the PR's Vercel preview.

SPEC IMPACT: Applied — `0012_papic/Papic_Live_Build_Plan_2026-07-08.md` Phase 5 (D5). Closes the
wall-setup gap; the projection + screen codes + moderation already shipped.
