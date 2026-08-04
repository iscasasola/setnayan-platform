## 2026-07-10 · chore(plan3d): one-piece character — completeness audit + gap closure

Owner: "make sure this is built complete and clear of gaps" (full authority).
A 6-dimension audit (surface coverage · dead wardrobe · constant drift ·
special figures · docs · material integrity) over every surface the character
touches. Findings fixed:

- **+1 reserved-seat ghost was an old thin cylinder+sphere token** (couple lab,
  `SeatedAvatar` null branch) — off-brand beside the chunky blobs. Reshaped to
  a chunky translucent blob (`TOKEN_BODY_GEO` capsule 0.17 + `TOKEN_HEAD_GEO`
  sphere 0.16 at the kit's HEAD_R), so the faint placeholder reads as a
  translucent sibling of the seated figures. Verified in a harness beside a
  real seated blob.
- **Dead render modules removed:** `kit/hair.ts` (6 procedural hairstyles) and
  `kit/face.ts` (drawn face decals) had ZERO consumers since the faceless blob
  — deleted, with their barrel export (`hairPartsFor`/`HairPart`) and the
  now-orphaned `SLEEVE_GEO`. `figure-rig`'s `resolveFigureLook` + skin/hair
  tables kept as DORMANT pure math (tested; a possible future re-skin), noted
  as such.
- **Throwaway dev page deleted:** `/dev/figure-lab` — its own header said
  "delete once the winning style folds into kit/figure.tsx"; that shipped
  (the blob), and it still rendered the retired gown/barong/hair cast.
- **Material single-sourced:** the satin params (roughness 0.5, metalness 0.02)
  were hardcoded in TWO places — `mannequinMaterial` (individual figure) and
  the instanced crowd's inline material — a silent pixel-identity drift risk.
  Now both read one `MANNEQUIN_SURFACE` constant.
- **Stale docs corrected:** "Sims-like"/"hair, simple faces, varied outfits"
  headers in `figure.tsx`, `figure-rig.ts`, `kit/index.ts`, and the
  guest-venue "Sims-style" — all now describe the one-piece faceless blob; the
  figure head comment no longer references a "drawn face decal / hair" branch
  that doesn't exist.

Audited-clean (no change needed): all three surfaces render the kit figure with
correct gait clocks; `AVATAR_BODY_R` 0.24 ≈ the new silhouette half-width
(0.243); emote heights unchanged (standing head top moved <1 cm); dance + staff
idle clips (stretch/swaySing/thumbsUp/wave) read correctly on the chunkier body
(harness-verified); booth staff legitimately keep the outfit shells.

Full unit suite 1321/1321 · tsc clean · next lint clean (touched files) ·
retired-strings lint clean.

SPEC IMPACT: None (cleanup + doc alignment within the locked blob direction).
