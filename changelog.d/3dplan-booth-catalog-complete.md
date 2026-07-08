## 2026-07-08 · feat(plan3d): booth prop library — catalog completion set

The prop + idle + outfit foundation for the remaining 37 booth templates
(`0008_3DPlan_Booth_Template_Catalog_2026-07-08.md` rows 1–57 — the
`3dplan-booth-catalog-complete` PR the chassis slice sequenced).

- **`kit/booth-props.tsx`** — 34 new `BoothPropKind` members (57 total):
  maquette · chapel_arch · calendar_board · crate_stack · capiz_string ·
  mortar_rack (+ drawn starburst sign) · led_panel / led_floor · tech_set
  (laptop + QR standee) · music_stand · cello · hoop_ribbon · magazine_rack ·
  suit_form / barong_form · garment_rack / suit_rack · towel_stack ·
  glass_case · fruit_tower · recliner · arcade_set · low_table_cushions ·
  polish_rack · crystal_set · embroidery_hoop · print_press · gift_shelf ·
  trophy_shelf · dance_marks · ribbon_cans · traffic_cone · barber_pole ·
  perfume_organ. All mascot-smooth (RoundedBox / high-segment lathes /
  capsules), module-scope shared geometry, repeated elements as single static
  InstancedMeshes (most props ≤ 3 draws; tech_set / arcade_set are the
  plan's designated composites). New procedural CanvasTextures: calendar
  month grid (accent-ring circled date), scrolling LED colour bands,
  pseudo-QR, starburst sign, barber stripes. Animated props (LED scroll,
  barber spin) advance texture offsets as idempotent functions of
  `clock.elapsedTime` — wall-clock, never frame-count-bound. Colour rules
  honoured: fruit/food mounds food-true; capiz warm-gold emissive only
  (never palette-RGB); barong_form wears the kit's actual jusi barong
  material (pechera embroidery bump). `StaticInstances` gains optional
  per-instance Euler rotation (fanned cards, leaning covers, trailing cans)
  — identity when omitted, all existing tables unchanged.
- **`lib/figure-rig.ts`** — 11 new staff idle clips (21 total): typing ·
  pourArc · stretch · ribbonSwirl · countBeat · swaySing · strokeWork ·
  polishWipe · measure · boxPass · thumbsUp. Pure additive wall-clock
  overlays inside the shipped envelope contract (shoulders ≤ 3.0 rad,
  everything else ≤ 1.6 rad, knees never bend); every one of the 37
  templates maps onto the set (reusable verbs, not bespoke clips).
- **`kit/outfits.ts`** — new `robe` staff outfit for the choir (catalog build
  note): gown shell (floor-length, skirted), deep-burgundy field with a gold
  stole detail canvas.
- **Tests** — `lib/figure-rig.test.ts` extends the suite: 21-kind registry
  check, wall-clock determinism at fixed t for every new clip, signature-pose
  assertions (stretch reaches overhead, swaySing folds hands, strokeWork eyes
  the work, thumbsUp parks high), measure's in-phase elbows; the existing
  envelope / de-sync / buffer-reuse / composition loops cover all 21 kinds
  automatically. 1132/1132 unit tests green.

SPEC IMPACT: None (implements `0008_3DPlan_Booth_Template_Catalog_2026-07-08.md` as written; templates wiring lands in the next stage of this PR).
