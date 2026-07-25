## 2026-07-09 · fix(plan3d): sit-arrival blend — the run→sit handoff no longer snaps

Follow-up to the run-cycle port (the spawned chip task): when a walking/running
figure reached its chair, the root swapped `<group>` → `<SitController>`,
REMOUNTING the kit `<Figure>` — the fresh `FigureFrameDriver` initialises
`cur = from = target`, so the mid-stride pose snapped to neutral 'stand' in
ONE frame (~49° of hip swing + the jelly squash, clearly visible since the
walkers went 'run').

- **`arrivePose` + `arrivePhase`** on `SitController` — the takeover figure
  STARTS in the walker's frozen gait sample (same pose preset + same frozen
  clock ⇒ identical joints, delta-free takeover), holds it for exactly one
  rendered frame (the fresh driver's first frame snapshots it as its blend
  source), then flips to 'stand' — the kit's ⅓ s damp blend eases the limbs
  down WHILE the chair pulls back (350 ms; the windows overlap). The children
  render-prop now receives `(pose, phase)`. Reduced motion ignores it (snaps
  to the end state, as ever); a starved first frame that resolves the whole
  pull still wins with `setPose('sit')` (the hold runs before the phase
  machine).
- **`jellyAmp` mounts at the gait's settled amplitudes** (`kit/figure.tsx`)
  when the driver mounts mid-gait — starting from 0 would un-squash the torso
  in one frame, the scale half of the same snap.
- **Wired at all three hand-off sites:** lab Play walker (`arrivePose="run"`),
  lab crowd agents (`"walk"` — gated to `crowdQuality === 'high'`: a 'low'
  figure never mounts the frame driver, so the blend is inert there and the
  frozen stride would static-bake an arbitrary never-painted sample — caught
  by the review), homepage demo scripted seat walk (`"walk"` — via a new
  `gaitPhaseRef` out-ref on the Walker, the posRef/headingRef precedent,
  recorded into `SitState.arrivePhase` at `beginSit`).
- **Pure handoff-contract tests** (`lib/figure-rig.test.ts`): the frozen-stride
  takeover is delta-free, every blend step stays < 0.12 rad/frame, and the
  removed snap is documented at > 0.5 rad in one frame.

figure-rig suite 41/41 · full unit suite 1295/1295 · tsc clean · adversarial
review workflow on the diff. Feel is owner-eyeballed in the lab (send a guest
to a seat in Play mode).

SPEC IMPACT: None (motion-quality fix within the locked sit choreography).
