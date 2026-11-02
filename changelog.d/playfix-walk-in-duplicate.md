## 2026-06-26 · fix(seating-3d): Play "Walk everyone in" no longer leaves a ghost on the seat

Owner report: "the seats have people. when we do play, the person on the seat never left."

Root cause: in the 3D seating lab, a walk-in (the single "pick a guest up → tap a
table" walk, and the "Walk everyone in" / Play crowd) spawns a walking avatar from
the entrance to the chair — but the static `SeatedAvatar` was ALSO drawn at the
occupied chair the whole time. Every walking-in guest rendered twice: a ghost glued
to the seat while the real one walked in.

Fix — render each guest exactly once, mirroring the existing mid-swap exclusion:
- `seatedByTable` now skips guests who are walking in (the single `walker` OR any
  `crowd` agent), and suppresses a walking-in primary's hovering +1 ghost. The
  seated token reappears once they settle. (`WalkerState` gained a `gid`.)
- The single walk-in auto-settles ~1.2s after arrival (clears the walker → the
  static seated avatar takes over).
- The Play crowd auto-settles: once every agent reaches its chair (plus a ~0.6s
  "stand a beat"), the crowd clears and the seated avatars return — so Play ends with
  everyone *seated*, not standing. "Clear the room" still fast-forwards. Settle timing
  is owned inside the `Crowd` component (elapsed-time refs reset per crowd), so no
  detached timer can clobber a re-run; reduced motion settles immediately.

Typecheck clean · 16/16 seating-3d unit tests pass.

SPEC IMPACT: None (bug fix to shipped 3D seating lab behavior).
