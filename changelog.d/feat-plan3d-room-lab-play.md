## 2026-07-11 · feat(plan3d): wire the shared room into the couple lab "Play" (slice 8, PR 5/N)

The second locked surface — the couple lab's immersive "Play" walk. Two partners
(or a couple + coordinator) in Play mode on the same event now see each other's
characters walk the room live and can "say hi". Behind
`NEXT_PUBLIC_PLAN3D_SHARED_ROOM` (off) → byte-identical single-player.

- **`seating-lab-3d.tsx`**: the authed `me` (id + name) is the player identity →
  `usePlan3dRoom(eventId, roomSelf)` (identity is trivial here — no anon session).
  `<RemotePlayers>` draws the other online people in Play mode; a
  `<CameraMoveBroadcaster>` broadcasts MY first-person position while walking —
  heading from where the CAMERA looks (its floor-projected forward), so a peer's
  figure faces my look direction even while I strafe/turn. A "👋 Say hi" button
  (only when another person is here) waves the room.
- **Shared plumbing**: promoted `colorFromId` (+ `ROOM_PLAYER_COLORS`) into
  `lib/plan3d-room` (deterministic presence-ring hue) — now used by BOTH the
  guest walk and the lab (the guest walk's local copy is removed). Added
  `CameraMoveBroadcaster` (first-person) alongside the guest walk's
  `LocalMoveBroadcaster` (third-person) in `plan3d-remote-players.tsx`.

The lab's own `Walker`/`Crowd`/`Movers` (the couple's *plan* animations) are
untouched — remotes are a separate additive layer of *other online users*,
distinguished by their presence-colour ring.

**Flag-off = byte-identical**: `roomSelf` is null → hook opens no channel →
`enabled` false → the remote/broadcaster mounts render null and the greet button
is hidden.

+1 test (`colorFromId`) → core **20/20** green · `tsc` + guards clean. The
multiplayer visual is validated by a 2-device test before the flag flips.

SPEC IMPACT: None (completes the locked slice-8 surfaces: guest walk + lab Play).
