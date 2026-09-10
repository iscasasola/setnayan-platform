## 2026-09-06 · feat(3d-plan): a remote wears its own chibi — the walking half of "everyone sees your avatar"

Owner 2026-09-06: *"build what is not done."* #5229 drew seated guests as their
chibi through the RPC; a guest **crossing** the room was still a white mannequin
to everyone, because presence carried name + colour only.

- **The viewer's own resolved config rides `channel.track`** (presence, not the
  `greet` event) — so a peer who joins later still sees it. Re-tracked when it
  changes. The roster and `RemotePlayer` carry it **raw**; the pure room state
  never resolves.
- **The remote figure resolves it through the ONE fallback rule**
  (`selfFigureAvatar`) — junk from an older build declines to the mannequin,
  never to a hash-rolled default — and draws `<ChibiFigure>` with the presence
  colour still ringing the floor (the whole reason the colour exists).
- **It hops through the same pure clip the viewer's own figure uses**
  (`lib/figure-rig chibiHop`), amplitude easing on start/stop, no hop while
  standing or waving — applied to a child group inside the remote-players
  component, because `the-chibi-bounces-it-does-not-glide` pins **exactly one**
  `<ChibiBounce>` in the walk file and that stays true.
- Flag-off, or no avatar → the mannequin path, byte-for-byte as before.

Guards: `lib/a-remote-wears-its-own-chibi.test.ts` (both track calls, the
roster, the re-track, presence-not-greet, the one fallback rule, the hop, the
ring, the untouched mannequin path, still one bounce in the walk);
`plan3d-room.test.ts` extended (raw avatar rides presence; junk stays raw for
the renderer to decline; an older build reads as none).

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 row — the "left open" on the seated
row is closed.
