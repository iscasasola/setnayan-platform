## 2026-07-09 · style(plan3d): one-piece silhouette — the figure becomes the soft blob

Owner picked the Meccha-blob direction over downloadable character packs
(Quaternius/Kenney evaluated and declined — faces/clothes/blocky vs the locked
faceless-mannequin look). The procedural figure now matches the one-piece
reference silhouette: **no neck, no feet, chunky low-taper limbs, one soft
continuous form.** All limb LENGTHS and pivot heights unchanged — every
seat/approach/camera constant stays valid; only radii, dressing, and the head
lift moved.

- **No neck** — `NECK_GEO` deleted; the bigger ball head (`HEAD_R` 0.13→0.16)
  rests ON the shoulders (`HEAD_LIFT` 0.12→0.095), slight overlap. Photo-disc
  heads sized up to match (0.13→0.16).
- **No shoes** — the legs end in ROUNDED STUMPS grazing the ground
  (`SHOE_GEO` is now a sphere; part keys keep their historical names).
- **Chunky, barely-tapered limbs** — `ARM_GEO` r 0.042→0.058 · `LEG_GEO` r
  0.055→0.075 (native lengths unchanged, so every leaf scale holds) · taper
  flattened (thigh 1.28→1.14, shin 1.08→1.06, forearm 0.88→0.94) · joint
  balls follow (knee/hip 0.0705→0.086, elbow 0.0425→0.059, shoulder →0.068).
- **Fused body** — fuller pelvis capsule overlaps the torso bottom and thigh
  tops; slimmer, rounder torso (r 0.175→0.16, z 0.84→0.9) with arm pivots
  just outside it (`SHOULDER_X` 0.165→0.175).
- **Satin material** — `mannequinMaterial` roughness 0.18→0.5 (crowd material
  synced): the old gloss speculared every mesh-intersection crease and made
  the blob read as plates.
- Machinery: `SIT_PART_KEYS` 22→21 ('neck' removed), baker + instanced crowd
  + the pixel-identity test's independent reference rig updated in lockstep.

Verified live in a dev harness against the reference (front, profile, walk,
run, seated — screenshots) through three visual iterations. Unit suite
1295/1295 · tsc clean.

SPEC IMPACT: Character art direction (one-piece blob silhouette now
canonical). Logged in `DECISION_LOG.md` (2026-07-09) + memory
`project_setnayan_3d_character_look`.
