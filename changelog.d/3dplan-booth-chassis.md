## 2026-07-08 · feat(plan3d): booth-template kit — 9 chassis, staff outfits + idle clips, top-20 category templates

The booth-template kit per the owner-locked catalog
(`0008_3DPlan_Booth_Template_Catalog_2026-07-08.md`): every placed vendor
booth whose category resolves a template now renders a full mascot-smooth
build — CHASSIS × PROPS × STAFF MASCOT × SIGNAGE — on all three 3D surfaces
(couple lab · homepage demo · guest venue walk).

- **`kit/booth-chassis.tsx`** — the 9 shared chassis (COUNTER · STATION ·
  RISER · BACKDROP · DESK · DISPLAY · VEHICLE · CHAIR_STATION · GARDEN) as
  module-scope RoundedBox/lathe geometry (three's RoundedBoxGeometry from the
  installed package — no new dep), palette-aware cached materials with the
  kit's 0.45-roughness mascot sheen. `CHASSIS_SPECS` exports each chassis'
  footprint obstacle discs + sign anchor + staff anchor(s).
- **`kit/booth-props.tsx`** — 23 shared prop primitives (chafing dish, tiered
  cake, espresso machine + steam, bottle shelf, drum kit, mic stand, tripod
  camera, emissive LIVE lamp, emissive bulb mirror, console+speakers, bloom
  cart, drape wall, moving-head beam, donut board, shaker, easel, clipboard,
  podium, gown form reusing GOWN_GEO, umbrella/awning, banig CanvasTexture,
  drawn text nameboard). Repeated elements (bottles/bulbs/donuts/blooms) are
  single static InstancedMeshes; all textures procedural CanvasTextures.
- **Staff outfits** — `FigureSpec.outfit` union appended (non-breaking) with
  `chef_whites | apron | vest | uniform`: suit/neutral shells recoloured + a
  CanvasTexture garment detail each (double-breasted buttons, apron bib, vest
  V + buttons, chest stripe + badge). UV front verified empirically at canvas
  centre (u = 0.5) with a quadrant test.
- **Staff idle clips** — 10 pure wall-clock 2-key loops in `lib/figure-rig.ts`
  (`staffIdle`: pipingSwirl, shake, tamp, bowDraw, headBob, cardFlip,
  brushDab, wave, snap, present), applied like idleSway via a new
  `<Figure idleClip>` prop (overrides the quality-'low' static bake for ≤3
  staff per booth; reduced motion bakes the clip's held t=0 pose). +5 unit
  tests (envelopes, determinism, per-id desync, motion, buffer-reuse safety).
- **`kit/booth-templates.ts`** — the top-20 config table (leaf key →
  chassis/props/staff/signText/cardKind) + `boothTemplateFor` resolution
  (vendor category → taxonomy leaf → template, booth_type fallback) +
  `templateBoothObstacles` (chassis discs registered at all three call
  sites). The remaining 37 leaves deliberately fall back to the generic
  BoothMesh silhouette — the complete catalog is the next PR
  (`3dplan-booth-catalog-complete`).
- **`kit/booth-template.tsx`** — the `<BoothTemplate>` renderer, mounted via
  the shared `BoothMesh`; PRO/ENTERPRISE logo BoothSign unchanged (hung at
  the chassis sign anchor), unbranded booths get the drawn nameboard. The
  scene's invisible booth tap-target contract is untouched.
- **`/dev/booth-lab`** — internal preview grid stepping through the shipped
  templates (the /dev/figure-lab precedent; kept for the catalog-complete PR).

Draw budget per template ≈ 20–35 draws (chassis ≤ 8 · props 1–5 each, ≤ 2
where instancing applies · staff ~12/figure at quality 'low' with shadow
casting off · sign 2). typecheck + lint + 1124 unit tests green.

SPEC IMPACT: None (implements the already-locked 2026-07-08 booth-template
catalog; slice 1 of 2 — system + top-20).
