## 2026-09-06 · feat(3d-plan): the chibi dances

Owner 2026-09-06: *"yes do it."* On the dance floor a Heritage or Blocky guest
runs the rig's `dancePose`; the chibi only hopped in place, because the rig is
jointless below the neck and nothing had been written for what it *can* do.

- **`chibiDance(id, t, amp)`** (`lib/figure-rig.ts`, beside `chibiHop`) — the
  four things a chibi can do on a beat: bounce (with a real landing each beat),
  lean side to side, turn a little, and bob its head — the head being the one
  group the chibi rig mounts separately (`userData.headGroup`) for exactly
  this. Same beat clock as the rig's dance (`DANCE_HZ`), so a chibi and a
  Heritage guest on one floor keep time; same per-id phase offset, so a crowd
  never dances in unison. Every channel is bounded for all t.
- **`ChibiBounce` learns to dance.** `dancing` is the SAME condition that puts
  the rig figure into `pose="dance"` (at rest, on the floor, not waving). The
  dance amplitude eases in and out so a chibi never snaps mid-beat, the hop
  and the dance compose (walking off the floor ends the dance), reduced motion
  zeroes the lean and the turn as it already zeroed the hop, and the head
  group is found once by traversal.
- The walk file still mounts exactly one `<ChibiBounce>` — the standing guard
  holds.

Guards: `lib/the-chibi-dances.test.ts` — amp 0 is the identity; every channel
inside its envelope for all t and the figure never sinks; the bounce lands and
reaches its apex; deterministic per id and not in unison; amp scales and the
out-buffer is reused; the walk dances under the rig's own condition, on the
wall clock, on the head group, and stops when moving.

Not done: remotes do not dance for ANY style yet (the room protocol carries no
"dancing" flag) — the rig figure has the same gap, so this is parity, not a
chibi regression.

SPEC IMPACT: None — the rig spec's § 11 "dance on the reduced joint set" (PR-2)
is now partially delivered; noted in `DECISION_LOG.md`.
