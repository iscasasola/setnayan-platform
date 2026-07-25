## 2026-07-09 · feat(plan3d): run cycle + jelly squash — the ChameleonMovement port

Second half of the "Meccha-style" figure-motion direction (the walk retune was
PR #2954): the owner's ChameleonMovement.jsx prototype — goofy toy biped,
math-driven walk/run/idle with heavy bounce, deep impact squash and jelly
inertia — reconciled into the shared figure kit. No new geometry, no schema,
no networking.

- **`runCyclePose`** (`lib/figure-rig.ts`) — the sprint flavour of the toy
  gait: RUN_HIP_SWING 0.85 (the prototype's legSwing verbatim) · knees pump
  0.95 · arms carried bent + driving (rest 0.5, pump 0.28) · bounce apex
  +0.08 m (under a run-suite 0.1 cap) · forward torso pitch RUN_LEAN 0.22 rad
  for momentum · waddle 0.04 TIGHTER than the walk's 0.06 (the prototype's
  runWaddleMult 0.6 — a sprinter leans in, doesn't rock).
- **`jellySquash`** (`lib/figure-rig.ts`, pure + unit-tested) — impact-weighted
  squash-&-stretch: short+wide at each footfall, tall+narrow at the bounce
  apex, squash > stretch (weight landing), volume ≈ conserved (y·xz² ≈ 1).
  Replaces the symmetric ±6% torso scale from #2954.
- **Damped jelly amplitudes** (`kit/figure.tsx`) — squash/stretch amounts ease
  toward the pose's targets (walk 0.09/0.05 · run 0.14/0.08 · else 0) with the
  same ⅓ s frame-rate-independent settle as the joint blend, so walk→run
  deepens smoothly and a stopping figure relaxes instead of popping. Static
  bake resets torso scale (an unmounting driver can't freeze a squashed body).
- **Pose `'run'`** joins the kit (`FigurePoseName`), with gait clocks
  single-sourced: `WALK_CLOCK_RAD_S = 11` · `RUN_CLOCK_RAD_S = 16`
  (stride ≈ speed ÷ (clock/2π) — the pairing that kills foot-slide).
- **Fast movers now scurry** — demo roam/dance taps (1.7 m/s, via a new
  `WalkState.run` flag set by `walkToPoint` when speed ≥ RUN_AT_MPS 1.6),
  guest venue seat beeline (2.2 m/s), lab Play walker (2.4), lab swap mover
  (2.6), lab dancer glide (2.6 — whose clock was still the pre-kit ×9;
  fixed). Scripted 1.45 m/s seat strolls and the ambient lab crowd keep the
  walk.

**Adversarial review (47-agent workflow, every finding execution-verified)
fixed before merge:**

- **⚠ `applyPose` torsoLean sign bug (pre-existing, surfaced by RUN_LEAN):**
  the applier negated `torsoLean` like a hanging limb, but for the UP-pointing
  torso that mirrors the pitch — every authored forward lean (sit's social
  lean, the walk/run momentum pitch, staff-idle leans) silently rendered
  BACKWARD. `lib/figure-sit-bake.ts` now applies torsoLean UN-negated
  (matching how the head channels always applied), restoring authored intent.
  **Visible change to shipped looks:** seated guests now lean ~5.7° forward
  (as designed) instead of backward — owner should eyeball.
- **Run flag now decided on REALIZED speed** (post-duration-clamp) in the demo
  `walkToPoint` — a sub-metre roam tap gets its duration floored to 500 ms,
  dropping the real pace below walking; it now walks instead of sprinting in
  place.
- **Lab arrival comment corrected** — the run→sit handoff REMOUNTS the figure
  (one-frame snap, pre-existing, magnified by run); blending it is a spawned
  follow-up task.
- **Test hardening (mutation-review driven):** buffer-reuse purity for
  walk/run/jellySquash · absolute envelope floors (bounce apex ≥ 0.07,
  footfall dip < 0, lean ≥ 0.15, knee pump ≥ 0.8) · waddle SIGN lock (rock
  toward the planted foot, both gaits) · knee amplification compared at the
  cos-lobe peak (φ=0, not the vacuous π/2) · run-waddle strictly 0 < run <
  walk. Six stale "~9 rad/s / walk-cycle / three poses" comments fixed.

`figure-rig.test.ts` 39/39 · full unit suite 1293/1293 · tsc clean · run/walk
render paths + run→stand jelly relax verified live in a dev harness
(screenshots). Run *feel* still owner-eyeballed; every lever is one named
constant.

SPEC IMPACT: Character motion direction (run cycle + jelly inertia now
canonical) + the torsoLean render-direction correction. Logged at the bottom
of `DECISION_LOG.md` (2026-07-09) + memory
`project_setnayan_3d_character_look`.
