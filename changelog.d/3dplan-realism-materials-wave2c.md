# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(seating-3d): Wave 2c materials — textured floors + fabric tablecloths across all 3D surfaces

Owner directive (2026-07-04): the 3D Plan must read as a real venue, "not a half-finished 3D design." Wave 2a/2b already shipped environment lighting, soft shadows, archetype room shells and decor — but the big flat surfaces were still solid palette colours with only a roughness map. This pass gives them a real material read, additively (no engine change, no schema).

- **New shared procedural detail maps in `scene-lighting.tsx`** (same lazy module-singleton `CanvasTexture` pattern as the existing `floorRoughnessMap`, no asset files, no fetch — CSP + offline safe):
  - `floorAlbedoMap()` — pale marble/stone with soft veining + a subtle tile grid. Near-WHITE so it MULTIPLIES the palette floor colour (`map * color`) — the room stays fully themeable, the pattern only adds richness. Tagged `SRGBColorSpace` (colour map); bump/roughness stay linear data maps.
  - `floorBumpMap()` — grayscale grout grooves aligned to the same tile grid so seams catch a sliver of the raking key-light shadow (`bumpMap`; no tangents needed, cheaper than a normal map).
  - `fabricBumpMap()` — a fine warp/weft weave so tablecloths + tabletops read as cloth, not painted plastic.
- **Wired into every 3D surface's floor** (all three already imported from `scene-lighting`): the shared demo/guest scene (`plan3d-scene.tsx`), the public guest venue walk (`guest-venue-3d.tsx`), and the couple lab (`seating-lab-3d.tsx`) — each floor material gains `map` + `bumpMap` alongside its existing `roughnessMap`.
- **Fabric on the cloths**: the lab's draped tablecloths (round + rectangular skirts/tops) and the shared scene's tabletops gain `fabricBumpMap()` at a subtle `bumpScale`.

Because the maps are shared singletons wired through the one lighting module, all three surfaces (in-app lab, guest walk, homepage 3D-Plan demo) lift together — one pass, every surface. Next in the program (owner-directed): `band` + live-cooking + live-performance booth types, and Pro/Enterprise vendor logo textured onto the 3D booth (tier-gated).

SPEC IMPACT: None — additive material fidelity on the shipped Wave 2a/2b 3D engine; no new schema, pricing, or product surface.
