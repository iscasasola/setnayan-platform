# Changelog fragment — 3dplan-room-magic (review fixes)

## 2026-07-08 · fix(plan3d): room-magic review fixes — tunnel gating/clamping, mobile quality, emote texture memory

Post-review hardening pass over the room-magic wave (cold-spark tunnel + dance-floor mural + emote bubbles). Six findings triaged; all six confirmed and fixed.

- **`kit/entrance-tunnel.tsx` — lateral gate on the progress projection.**
  `coldSparkProgress` was a pure axial dot product, so ANY live walk inside the
  tunnel's 6 m axial band sequenced the fountains — a roam walker crossing the
  room 8 m beside the corridor ramped pairs (and could trip the climax beat),
  and a seat approach swinging back near the entrance wall drove t back down,
  visibly dimming already-fired pairs. The projection now returns −1 when the
  walker is more than `COLD_SPARK_GATE_M` (1.2 m — the machine-row offset) off
  the centreline; only a real corridor pass sequences the show.
- **`kit/entrance-tunnel.tsx` — shallow-room clamp.** The corridor build and
  path nodes assumed ≥ ~6.9 m of inward depth, but venue dims are user-editable
  down to 4 m (seating-editor clamp), which put bay nodes, machine boxes and
  the lead-out BEYOND the far wall — the scripted walk threaded the avatar (and
  chase cam) through the wall. `ColdSparkFrame` now carries `len`: the nominal
  6.0 m clamped to the available inward depth minus the lead-out + a 0.45 m
  wall clearance; every bay position, path node, obstacle disc, runner, fog
  plane and the progress normalisation scale with it (`coldSparkBayS`).
- **`kit/entrance-tunnel.tsx` — low tier keeps all 8 machine boxes.** The
  'low' tier dropped fountain pairs 1+3 AND their machine boxes, but
  `coldSparkObstacles` always registers 8 discs — public guest walkers dodged
  four invisible boxes. The boxes are one instanced draw, so all 8 now render
  on both tiers; 'low' halves only the fountains (pairs 2+4 survive, the climax
  pair included), particle counts and fog, matching the catalog fallback.
- **`kit/entrance-tunnel.tsx` — sequencer settle snap.** The ramp's early-out
  tested the per-frame STEP against epsilon, stalling each fountain a
  frame-rate-dependent offset short of target (~0.04 at 120 Hz). It now snaps
  to target when within epsilon OF THE TARGET (one final write), keeping the
  zero-write steady state and the wall-clock law honest.
- **`home/plan3d-demo-overlay.tsx` — mobile quality budget.** The homepage 3D
  demo overlay never passed `quality`, so phones rendered the full 'high' tier
  (8×250 spark particles + 3 fog planes + desktop shadow/env budget) in a 360px
  canvas. It now derives `quality` from the SYS-1 `useIsMobile` switch and
  passes 'low' below `lg`.
- **`kit/emotes.tsx` — per-glyph cell textures.** Six SpriteMaterials each
  wrapped its own CanvasTexture over the SAME full atlas canvas — WebGL keys
  uploads by Texture object, so six full-atlas GPU copies (~2.3 MB) landed
  where one atlas's worth suffices. Each glyph now rasterizes its own 128px
  cell canvas (six cells ≈ exactly one atlas of texture memory, total); the
  offset/repeat windowing and the misleading "share the ONE canvas" comment
  are gone. Zero visual change.

Gates: `pnpm typecheck` + `pnpm test:unit` (1151 pass) + `pnpm lint:radius` green.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Tunnel_Catalog_2026-07-08.md (cold_spark shipped) + 0008_3DPlan_Fable_Design_2026-07-08.md (mural + emotes shipped)
