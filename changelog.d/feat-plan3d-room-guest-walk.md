## 2026-07-11 · feat(plan3d): wire the shared room into the guest venue walk (slice 8, PR 4/N)

The first live surface for the 3D shared room — the public guest venue walk
(`/[slug]/venue`). When 2+ people are on the same event's walk, each now sees the
others' characters walk in real time and can "say hi". All behind
`NEXT_PUBLIC_PLAN3D_SHARED_ROOM` (off) → the single-player walk is byte-identical.

- **`guest-venue-3d.tsx`**: a stable per-session identity (`makeSelfId` + a
  distinct presence-ring `colorFromId`) drives `usePlan3dRoom(eventId, me)`. The
  self-avatar writes its live floor position to a shared `walkerPosRef`; a
  `<LocalMoveBroadcaster>` reads that ref and broadcasts {pos,vel,heading,moving}
  (no edits to the delicate walk loop). `<RemotePlayers>` renders the peers. A
  "👋 Say hi" button (only when others are online) waves at the room — the
  wave plays on my own figure too (`waveUntil` → the self-avatar pauses to wave).
- **`page.tsx`**: hoists the event UUID to top scope + passes it through the
  loader → scene. (No PII on the wire — presence carries a name + colour only.)
- Reusable `LocalMoveBroadcaster` added to `plan3d-remote-players.tsx` so the lab
  Play surface (PR 5) drops in the same way.

**Flag-off = byte-identical:** `me` is null unless the flag is on AND there's an
eventId, so the hook opens no channel, the remote/broadcaster JSX renders null,
the greet UI is hidden, and `waveUntil=0` leaves the self-figure's pose untouched.

`tsc` + guards clean; the pure core stays 19/19. The multiplayer VISUAL can't run
headless — it's validated by a 2-device test before the flag is flipped.

SPEC IMPACT: None (implements the locked slice-8 design on the guest walk).
