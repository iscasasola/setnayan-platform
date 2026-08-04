## 2026-07-11 · feat(plan3d): shared-room remote-player renderer (slice 8, PR 3/N)

`app/_components/plan3d/plan3d-remote-players.tsx` — renders the OTHER online
people's characters in the shared room. One walking `<Figure>` per remote,
driven purely by the `{pos,vel,heading}` frames `use-plan3d-room` receives:
- dead-reckoned between packets (`renderRemote`), pose (stand/walk/run) + facing
  derived from velocity, heading eased with the scene's `lerpAngle`/`damp` so
  network jitter doesn't snap-spin the figure;
- a "say hi" wave overlaid when greeted (`idleClip="wave"`, which pauses the
  figure to a stand — the rig only overlays idle clips on stand);
- a matte-white mannequin like everyone else, told apart only by its
  presence-colour status ring (the locked look); pose/wave update as React state
  ONLY on transition (never per frame).

It's an ADDITIVE overlay: renders nothing when `remotes` is empty (single-player /
flag off / offline), so the resting all-seated room is unchanged. Keyed by peer
id so a figure keeps its phase/heading refs across map updates; present-first +
nearest-first + capped at MAX_REMOTES (phones).

Also adds `remoteMovers()` to `lib/plan3d-room` (dead-reckoned {x,z,vel} per
present remote → feeds the local walker's avoidance seam in the wiring PRs) and
tightens the hook's prune window to 2.5 s so a departed character despawns
promptly (never abandoned mid-floor; the seated crowd underneath is the resting
state). NOTE: a literal walk-back-to-seat on presence drop needs a peer→seat
mapping not yet on the wire — v1 does a prompt graceful despawn; the walk-home
path is a documented refinement (peer broadcasts its seat).

+1 unit test (`remoteMovers`), suite 19/19 green · `tsc` + guards clean. Nothing
mounts this renderer yet (PR 4+ wire the surfaces) → inert. The visual is
owner-eyeballed in the 2-device test.

SPEC IMPACT: None.
