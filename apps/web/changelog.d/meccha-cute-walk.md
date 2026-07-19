## 2026-07-09 · style(plan3d): "Meccha-style" cute/adorable figure walk

Owner direction (2026-07-09, reference shared): retune the 3D figure gait from
the old realistic indoor stroll to the springy, toy-like walk of the white
mannequin game character (Meccha Chameleon — the same character the shipped
`plan3d/kit` figure already looks like after the 2026-07-08 avatar pivot). The
LOOK was already there (blank palette-tinted mannequin, no wardrobe); this pass
is entirely about the MOTION FEEL. Five named levers so live tuning maps to one
number each:

- **Bounce** (`lib/figure-rig.ts` `WALK_BOB_M` 0.035 → 0.06 m) — a real springy
  double-bounce (one lift per footfall). Apex +0.048 m stays under the unit
  suite's 0.06 m bob cap.
- **Waddle** (`WALK_WADDLE` 0.06 rad) — new `torsoSway` rock toward the planted
  foot, one rock per step (was flat zero on the old stroll).
- **High knee lift** (`KNEE_FLEX` 0.55 → 0.72 rad) + **big loose arm swing**
  (`ARM_SWING` 0.35 → 0.52 rad, livelier elbow pump) + a small happy head bob.
- **Squash-&-stretch** (`plan3d/kit/figure.tsx` `WALK_SQUASH` ±6%) — the torso
  group stretches tall at the apex / squashes wide at each footfall, synced to
  the same `|sin(phase)|` bounce, eased in/out by the pose blend, walk-only
  (legs keep their plant; `applyPose` never writes `torso.scale`).
- **Quicker cadence** — the shared gait clock 9 → 11 rad/s on all three surfaces
  (homepage demo `plan3d-scene.tsx`, couple lab `seating-lab-3d.tsx`, public
  guest walk `guest-venue-3d.tsx`) for the quick-little-steps scurry.

All within the existing rig channels — no new geometry, no new networking, no
schema change. `lib/figure-rig.test.ts` still green (antiphase legs, arms
counter-swing, knees ≤ 0, bob ≤ 0.06 all hold). Walk *feel* is not verifiable
in preview/CI (r3f taps don't fire headless) → owner eyeballs live and requests
per-lever tuning.

SPEC IMPACT: Character art/motion direction. Logged at the bottom of
`DECISION_LOG.md` (2026-07-09) + memory `project_setnayan_3d_character_look`.
The "Meccha-style" gait is now the canonical 3D-figure walk.
