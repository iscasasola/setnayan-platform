## 2026-07-11 · feat(plan3d): shared-room pure core (slice 8, PR 1/N)

First layer of the 3D-Plan "shared room" (2+ online people on one event's 3D map
see each other's characters walk in real time + "say hi"). This PR adds ONLY the
network-agnostic PURE core — no React, no Supabase, nothing imports it yet — so
it's 100% unit-testable headless (the multiplayer surface itself can't run in CI).

`lib/plan3d-room.ts`:
- Wire messages `MoveMsg` ({id,x,z,vx,vz,h,m,t}) + `GreetMsg`; `RoomPeer` roster.
- `shouldBroadcastMove` — ~8 Hz throttle, only-while-moving + one settle frame on
  stop (idle players are silent).
- `deadReckon` / `isMoveStale` / `renderRemote` — extrapolate a remote along its
  last velocity (capped), freeze a peer that dropped its stop-frame, derive
  pose (stand/walk/run) + heading from {pos,vel} alone so a remote animates like
  the local walker.
- Reducers over the remote map: `reconcilePresence` (spawn/absent/refresh, self
  excluded), `applyMove` (self-echo + rosterless-ghost guards, drops stale
  frames), `applyGreet` (wave plays on the SENDER, gated on presence — "no
  greeting ghosts"), `pruneRemotes`.
- `activeRemotes` — present-first, nearest-first, capped at MAX_REMOTES (phones);
  `isGreetable` presence gate.

18 unit tests (`lib/plan3d-room.test.ts`), all green · `tsc` + guards clean.

Behind the upcoming `NEXT_PUBLIC_PLAN3D_SHARED_ROOM` flag (off by default); this
PR wires nothing, so it is inert.

SPEC IMPACT: None (implements the locked slice-8 design; corpus already describes it).
