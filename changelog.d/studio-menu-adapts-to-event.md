## 2026-09-01 · fix(studio): the Studio sidebar adapts to the event it is inside

Owner, 2026-09-01: *"when we click the event, the studio should adapt to the
event itself, and only show the services that works for that event."*

The Studio sidebar (`lib/studio-rail.ts`, rendered inside `front-door-shell.tsx`)
was the THIRD surface to drift from `lib/add-on-event-scope.ts`'s one
event-type gate — it re-derived the check with a raw `surfaceEnabled()` call
instead of going through `addOnOfferedForEvent`, and two of its rows (Live
Studio, Pakanta) carried no `ProfileSurface` at all, so they showed on every
event type regardless of the owner's ruling. A third row (3D Plan) declared no
`surface` either, despite the `seating` surface it should have ridden already
correctly excluding date/hangout/travel in the database.

- Two new surfaces: `livestream` (hidden on date · hangout · travel) and
  `song` (hidden on date · hangout · travel · simple_event) — migration
  `20271188752170`, idempotent, with post-condition assertions.
- `lib/studio-rail.ts` now calls `addOnOfferedForEvent` (the same predicate
  the Suite grid uses) instead of a re-derived `surfaceEnabled` check.
- Declared `surface` on the Studio sidebar AND the matching catalogue entries
  so the sidebar and the Suite grid cannot disagree: Live Studio → `livestream`
  (`panood`, `live-studio-roam`), Pakanta → `song` (`pakanta`), 3D Plan →
  `seating` (`pa3d`'s `STUDIO_APPS` entry and the `seating` `add-ons-catalog`
  entry it opens — this one needed no migration, only the missing code wiring).
- Fixed the stale `event-type-profile.ts` docblock claiming "PHASE 0 CONTRACT:
  nothing consumes this yet. Only the wedding row is seeded" — 17 rows are
  seeded and several modules consume it.
- New test `lib/studio-menu-adapts-to-event.test.ts` pins the sidebar and the
  Suite grid to agree for every event-type shape, pins the row counts from the
  ruling (wedding 9 · ceremonial & party 8 · simple_event 7 ·
  date/hangout/travel 5), and mutation-tests the `livestream` surface.

SPEC IMPACT: None — this implements an already-locked owner ruling; no new
decision to record.
