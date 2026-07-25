## 2026-07-11 · feat(plan3d): shared-room realtime hook + flag (slice 8, PR 2/N)

`app/_components/plan3d/use-plan3d-room.ts` — the React + Supabase Realtime
wrapper around the tested `lib/plan3d-room` core. One per-event channel
`plan3d-room:{eventId}` that:
- tracks PRESENCE (who's live in this room; name + colour only, no PII),
- broadcasts the LOCAL character's {pos,vel,heading,moving} at ~8 Hz
  only-while-moving (`shouldBroadcastMove` + a `lastSentRef` ms-gate),
- folds incoming peer `move`/`greet` frames into a `RemoteMap` via the pure
  reducers, and prunes long-departed peers.

Returns `{ remotes, onlineCount, sendMove, greet, selfGreetUntil, enabled }`.
Conventions mirror `use-seating-presence` exactly (client-in-effect, `feature:
{eventId}` name, `broadcast:{self:false}`, refs for mutable state, `removeChannel`
teardown, `ch.state==='joined'` send-gate, payload validators).

**Flag-gated + offline-first:** `NEXT_PUBLIC_PLAN3D_SHARED_ROOM` (documented in
`.env.example`) defaults OFF → the effect never opens a channel, `remotes` stays
empty, `sendMove`/`greet` no-op, so every surface is byte-identical single-player.
A dropped channel silently degrades to single-player and rejoins.

Nothing mounts this hook yet (PR 3 renders remotes; PR 4+ wire the surfaces), so
it is inert. `tsc` + guards clean. (The pure logic it wraps is covered by PR 1's
18 tests; the channel glue is exercised by the eventual 2-device test.)

SPEC IMPACT: None.
