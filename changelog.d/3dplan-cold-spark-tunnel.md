## 2026-07-08 · feat(plan3d): cold-spark entrance tunnel — sequenced to the walk

Ship-first #1 of the owner-locked evolved entrance-tunnel catalog
(`0008_3DPlan_Tunnel_Catalog_2026-07-08.md` — the PH money effect): the
`cold_spark` treatment, a 6.0 m fountain walk whose spark pairs fire AS the
walker passes them.

- **`lib/reception-scene.ts`** — new tunnel enum option `cold_spark`
  ("Cold spark walk") added ADDITIVELY before `none` (nothing removed;
  the other catalog treatments land with their own builds), plus a matching
  2D SVG branch in the `entrance()` dispatcher (dark machine boxes + titanium
  gold-white spark fans — the mood-board preview no longer falls back to the
  floral default).
- **`kit/entrance-tunnel.tsx`** (NEW) — `<ColdSparkTunnel>` per the catalog
  row: 8 filleted dark machine boxes in 2 rows (one InstancedMesh), each
  fountain a tall thin drei `<Sparkles>` column (250 particles high / 100 low)
  over an emissive core cone (the Play-mode bloom stars), 3 stacked soft-alpha
  fog discs (dropped on 'low'), and a palette runner. Sparks are titanium
  gold-white, NEVER palette-tinted (realism rule). Sequencing consumes an
  exposed `progressRef` (walker path-t along the tunnel segment): pairs ramp
  via a PURE intensity function of progress + a frame-rate-independent damp —
  wall-clock only, nothing frame-count-bound; the final pair ignites brighter
  at t ≥ 0.85 (intensity-only climax; the chase-cam tilt-up ships with
  cinematic Play). Idle = gentle low shimmer. Reduced motion = static shimmer
  (particle drift speed 0), and the walk completes exactly as before.
  Pure helpers exported: `coldSparkFrame` (entrance + inward wall normal) ·
  `coldSparkObstacles` (8 discs r 0.3) · `coldSparkPathNodes` (bay midpoints +
  0.5 m lead-out) · `coldSparkProgress` (axial projection) ·
  `coldSparkIntensity`.
- **`venue-decor.tsx`** — when the reception design's tunnel is `cold_spark`,
  `VenueDecor` renders `<ColdSparkTunnel>` along the entrance approach instead
  of the classic `EntranceArch`; optional `tunnelProgressRef` prop threads the
  walk feed through (lab/orbit surfaces omit it → idle shimmer).
- **`plan3d-scene.tsx`** — the scripted "Where am I seated?" walk THREADS the
  tunnel centreline (catalog § 4): bay-midpoint nodes + a 0.5 m lead-out
  prepended to the seat-approach path; a render-less `<ColdSparkWalkFeed>`
  projects the walker's live position onto the tunnel axis every frame and
  feeds the tunnel's progress ref (−1 when idle). Machine-box discs join
  `fixtureObstacles` the same way booth chassis discs do.
- **`guest-venue-3d.tsx` + `seating-lab-3d.tsx`** — the machine-box obstacle
  discs register in both surfaces' fixture sets too (their walkers/crowds
  round the boxes; both get the tunnel visuals via the shared `VenueDecor`).
- **`kit/index.ts`** — barrel exports for the new module.

Budgets: 'high' = 8 Sparkles draws + 8 core cones + 1 instanced machine draw +
3 fog + 1 runner (~21 draws, 2 000 GPU-side particles); 'low' (phone walk) =
4 fountains × 100 particles, no fog (~10 draws). Per-frame CPU work is a
handful of damped floats + an opacity-attribute fill only while a fountain's
level is actually moving.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Tunnel_Catalog_2026-07-08.md (cold_spark row shipped — enum + walk-sequenced 3D build)
