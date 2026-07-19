## 2026-06-26 · feat(seating-3d): game-pad "Walk around" mode (left stick move · right look · pinch zoom)

Owner direction (asked twice): a Play-mode toggle to walk the venue like a game —
"left navigation circle walks, right sets the camera angle, pinch to zoom."

- **`lib/seating-3d.ts`** — `walkVector(yaw, moveX, moveForward)` (pure,
  unit-tested): the first-person directional math (forward follows the look,
  strafe 90° right).
- **`seating-lab-3d.tsx`** — a Play-mode **"Walk around" toggle**; on:
  `CameraRig` is swapped for a `WalkController` (first-person camera at eye
  height) and OrbitControls is disabled. `WalkStick` (bottom-left joystick) →
  move via walkVector; `LookPad` (right half) → yaw/pitch; two-finger pinch →
  FOV zoom. Reuses `pushOutOfDiscs` so you can't walk through tables/stage, and
  walk mode drops whenever you leave Play.
- **`lib/seating-3d.test.ts`** — +1 case (10 total) pinning walkVector's
  forward/strafe directions across yaws.

⚠ The directional MATH is tested, but the control FEEL (speeds, sensitivities,
stick placement, pinch) is unverified — tune on preview. Pinch is the roughest
bit. Stage/overlap placement rules + the stage-size sync bug are the next batch.

SPEC IMPACT: 0008 Seating — 3D lab gains a walk-the-room mode.
