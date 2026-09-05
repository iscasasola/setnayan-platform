## 2026-09-06 · feat(venue): the room you are standing in keeps up — a seat moved during the event reaches the guests inside

Owner 2026-09-06: *"seating can always change in the last minute and even during
the event."* The guest walk fetched the scene once, on the server; a seat moved
at 6pm was what a guest saw the next time they opened the page, never under their
feet. The control centre said so honestly (#5219); this closes the gap.

- `public_venue_scene` is anon-callable, so the browser asks it again: every
  60 s while the tab is **visible**, and the moment it becomes visible again.
  A hidden tab never polls (a phone in a pocket should not spend battery on a
  room nobody is looking at).
- **News is a seat that moved, not a palette that changed.** The scene is
  swapped in only when its signature (tables · occupancy · booths · you · floor
  · photos) differs — no re-mount on an identical answer, no re-tint under a
  guest's feet.
- A failed call is not news: the last good scene stays. `{published:false}` IS
  news: a quiet banner says the couple took the room down.
- Deliberately a poll, not a Postgres-changes subscription: the tables that
  change are couple-private under RLS, so an anon subscription would deliver
  nothing and render exactly like "no changes" — the disease.
- No slug → the one-shot room, byte-identical to before.
- `lib/venue-live-scene.test.ts` pins the cadence, the visibility gate, what
  counts as news, the taken-down answer, and the wiring through loader and page.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 row amended — "next open" is now
"within about a minute, while the room is open".
