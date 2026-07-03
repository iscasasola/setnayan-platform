# seating-3d-realism

## 2026-07-03 · feat(seating-3d): realism foundation — environment lighting, soft shadows, materials, instanced chairs

Wave 2a of the 3D seat-plan program: one shared realism layer across all three
R3F surfaces (couple lab · homepage 3D-Plan demo/phone walk · guest venue walk).

- **Shared lighting rig** `app/_components/plan3d/scene-lighting.tsx` —
  `SceneLighting` builds a procedural room environment from inline drei
  `<Lightformer>` panels only (warm key wall, cool fill, overhead wash, floor
  bounce — NO HDRI, NO network fetch), plus one warm shadow-casting directional
  with a shadow camera fitted tight to the room. `quality`: 'high' = 2048
  shadow map + 256 env (lab, homepage overlay) · 'low' = 1024 + 128 (phone
  walk, guest venue). ACES tone mapping via shared `RECOMMENDED_TONEMAP` on
  every surface's Canvas. Palette-driven (key/bounce follow `Lab3DPalette`) so
  Wave 2b mood-board treatments hook the same knobs.
- **Instanced chairs** `app/_components/plan3d/instanced-chairs.tsx` — the
  lab's documented "v2 draw-call collapse": seats + backrests render as TWO
  `InstancedMesh` draws per table regardless of capacity (150 chairs: ~300
  draws → 30). Honors `chairPlacements` (chairLocalPositions/serpentineChairs
  facing), `removedSeats` (zero-scaled out; the lab keeps individual tappable
  ghosts for restore), occupied/empty tint via `instanceColor`, and per-seat
  taps via `instanceId` (lab remove-chair tool unchanged). Adopted by the lab,
  the demo scene (which also gains chairs + product-true 0.74 m tabletops) and
  the guest venue walk.
- **Materials pass** — floors carry a shared procedural roughness-variation
  CanvasTexture (module-level, no asset files); table linen roughness 0.85;
  chair/wood 0.6; metallic accents (bar rail, LED-wall frame, entrance frame)
  metalness 0.7.
- **Shadows on the right things** — tables, fixtures, stages and walking/seated
  figures cast; floors receive; billboard photo avatars deliberately do NOT
  cast (a billboard would shadow as a floating circle). The lab drops its fake
  `ContactShadows` for real 2048 soft shadow maps.

LOOK-only: no data-model changes, no new fetches, no behavior changes to
swap/walk/roam/photos, zero new npm deps. Seat plan stays free.

SPEC IMPACT: None (visual-quality slice inside the already-logged 3D seat-plan
program; DECISION_LOG rows for the program cover it).
