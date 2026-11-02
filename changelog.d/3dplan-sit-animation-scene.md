# 2026-07-08 · feat(plan3d): phone walk ends in the chair pull-back sit

Wires the sit-controller machinery (previous fragment on this branch) into the
demo/phone surface — `apps/web/app/_components/plan3d/plan3d-scene.tsx`:

- The scripted "Where am I seated?" walk now ends at the seat's
  `approachPoint` (0.55 m behind the chair, `SIT_TIMING.APPROACH_M`) instead
  of ON the chair, then hands the figure to `<SitController>`: the instanced
  chair detaches (the demo's `TableMesh` opts in via the new `tableId` prop),
  pulls back, the figure steps in / turns / sits, and chair + figure tuck in
  together. The detached ActiveChair mirrors the occupied instance tint
  (base→accent lerp 0.28) so the swap never flashes.
- Callback ordering: `onWalkComplete` — the phone UI's "You're at <table>"
  line — now fires ONLY from the controller's `onSeated`, i.e. after the tuck
  lands flush (or immediately under reduced motion, which snaps straight to
  the seated end-state without detaching anything and still completes the
  flow).
- The Walker gains a `headingRef` out-param (mirror of `posRef`) so the sit
  clip's turn starts from the figure's ACTUAL smoothed arrival facing.
- Per-frame clamp discs exclude the destination table for the scripted walk
  (its 0.8 m avoidance ring contains the approach point — keeping it would
  shove the walker off the hand-off spot); the path still ROUTES around the
  destination, and the final leg is a radial step-in that can't cross the top.
- Chase camera holds its last frame through the whole sit (nothing writes the
  camera once the Walker unmounts) — no snap; OrbitControls stays unmounted
  while a sit clip is live. Free roam unchanged: no auto-sit, gold own-seat
  ring behaviour preserved, QR guest-click targets untouched.

Pure rendering + pure math — no server actions, no DB, no PII changes. No new
dependencies.

SPEC IMPACT: None
