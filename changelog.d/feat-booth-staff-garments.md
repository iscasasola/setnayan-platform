## 2026-07-10 · feat(plan3d): booth staff read distinct by garment (guests stay matte-white)

Owner reversed the earlier gap-12 call — booth STAFF should be visually
differentiated, NOT identical matte-white blobs. The garment machinery already
existed (`outfitMaterial` + per-role `staffGarmentTexture` + `trouserMaterial` +
`DEFAULT_CLOTH`) and already dresses static booth decor; it was just never wired
into the per-guest figure (the gap-12 finding). Now it is — but ONLY for staff:

- `figure.tsx` computes `garmentMat`/`legMat` from `spec.outfit` when
  `isStaffOutfit(spec.outfit)` (chef_whites/apron/vest/uniform/robe). Torso +
  arms wear the garment cloth (its CanvasTexture carries the chef buttons / apron
  bib / vest panels); legs wear the darker trouser cloth; head + joint stumps
  stay the body material, so the one-piece silhouette is unchanged — only the
  colour/texture reads as a role. `booth-template` passes `outfitColor: null`, so
  each role gets its `DEFAULT_CLOTH` (chef=whites · apron=terracotta ·
  vest=charcoal · uniform=service-green · robe=burgundy).
- GUESTS are untouched: their outfit (gown/suit/barong/filipiniana/neutral) never
  matches `isStaffOutfit`, so `garmentMat`/`legMat` fall back to `bodyMat` — the
  matte-white mannequin, exactly as before. The instanced seated crowd (guests
  only) is unaffected, so its pixel-identity guarantee holds.
- Exported `isStaffOutfit`; corrected the `outfits.ts` scope doc (staff figures
  now DO get `outfitMaterial`; the gown/suit SHELL geometries remain booth-decor
  only). No revert of #3021's geometry deletions needed — this uses materials,
  not shells.

`tsc` clean · radius + retired-string guards clean · 49 figure pose tests green.
The WebGL look is owner-eyeballed in the 3D lab / `/dev/booth-lab` (canvas render
isn't headless-verifiable), consistent with the prior figure work.

SPEC IMPACT: None (renderer honours existing per-role staff outfit data).
