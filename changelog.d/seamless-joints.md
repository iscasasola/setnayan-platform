## 2026-07-09 · style(plan3d): seamless joint-blend balls — no more "twisted balloon"

Owner direction: the figure read as "made of ovals, like a long balloon
twisted — we want no twisting; the joints area smooth and seamless." The limbs
are two tapered capsules whose rounded ends apex exactly at each pivot, so any
bend pinched like a balloon twist (outside crease + inside fold, plus a radius
step where the taper changes — thigh 0.0704 vs shin 0.0594).

- **Joint-blend balls** — one sphere AT each bending pivot (knees, hips,
  elbows, shoulders; 8 per figure), sized to the LARGER adjoining radial
  radius (`KNEE/HIP_BALL_R` 0.0705 · `ELBOW_BALL_R` 0.0425 ·
  `SHOULDER_BALL_R` 0.052, single-sourced in `lib/figure-sit-bake.ts`). A bent
  limb now reads as ONE smooth constant-radius tube at any angle; same body
  material, so the union is invisible when straight. New shared unit
  `JOINT_GEO` sphere in `kit/figure.tsx`.
- **Pixel identity preserved** — `SIT_PART_KEYS` grew 14 → 22 (append-only),
  the sit-bake builder bakes the ball matrices, the instanced seated crowd
  pairs the new keys with `JOINT_GEO`, and the pixel-identity test's
  INDEPENDENT reference rig gained the same leaves with literal radii —
  the crowd and the individual figure flip together, byte-identical.
- Draw-count comments updated (~14 → ~22 per occupant / instanced batch).

Verified: sit-bake suite 8/8 (incl. the per-key matrix cross-check) · full
unit suite 1293/1293 · tsc clean · **live harness screenshots** — seated
profile (90° knees + folded elbows), mid-run (deep knee pump), and walk all
read as smooth continuous tubes with zero console errors; the run's forward
lean also confirmed the torsoLean applier fix renders correctly.

SPEC IMPACT: Character art direction (seamless joints now canonical). Logged
at the bottom of `DECISION_LOG.md` (2026-07-09) + memory
`project_setnayan_3d_character_look`.
