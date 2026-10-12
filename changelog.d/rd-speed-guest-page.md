## 2026-10-12 · perf(guest-page): a guest view asks the database far fewer times, side by side, and none can hang

Built, not live. `HANDOVER.md` at the root of this branch says exactly where it
stands and what is still owed.

Owner: "the key was to lessen the requests". Counted by a harness that runs the
page's own loaders against a database that counts (`lib/guest-page-reads.*`) —
a floor for the shape, not production's number:

| Viewer | Requests | `events` reads | Steps one after another |
|---|---|---|---|
| Stranger, before the day | 23 → 15 | 8 → 1 | 10 → 5 |
| Stranger, on the day | 23 → 16 | 7 → 1 | 10 → 6 |
| Invited guest, before the day | 34 → 19 | 11 → 1 | 17 → 6 |
| Invited guest, on the day | 37 → 23 | 10 → 1 | 20 → 6 |

- **The event's row is read once per view** (`lib/event-row-once.ts`).
  `loadEventShell` asks for its own columns and the facts other readers wanted
  in one request and leaves the row in hand for that render; each reader asks
  there first and keeps its original read, untouched, for when the row is not
  in hand — so one that degraded still degrades and one that threw still
  throws. Per render only, service-role askers only, a copy per reader; the
  page's own event row is the row it always was. An unknown extra column
  (42703) → the shell is read alone, as before. The two invite doors
  (`invite/enter`, `invite/reply`) use the same held row instead of a second
  read of their own.
- **Fewer requests, same answers:** the Venue scene's stored choices come from
  the scene rows the view reads anyway; "is the guest camera on?" is asked once
  per render instead of three times; the data-privacy controls a guest-tree
  render asks about are one read; a guest's tagging answer and UGC-terms flag
  ride in with their own row.
- **Side by side** (no read added, each awaited where it was): the live layer,
  the entourage, the ownership chain's bundle list, an invited guest's own
  reads — which now leave beside the day-of layer (the loader is handed the
  schedule as a promise) under three conditions: a verified cookie, naming
  this event, no sample-guest preview.
- **A read limit** (`lib/read-limit.ts`): every read of `/[slug]`, its layout
  and the two invite doors waits at most 6 s, and all of one request's reads
  share a 10 s deadline. An essential read that does not answer ends the page
  with the guest boundary's words; a decoration read is left out for that view
  and logged. Writes are never limited.
- **The landing (`invite/enter`) starts its body's reads together**: the event
  type, the owner's slug, the QR look, the words, the plus-ones, the ticket
  pair, the account, the seat holder and (on the day) the table — each started
  at the top of the body and awaited where it was. Not the tile code (a write),
  not the ceremony time (one screen). The Maker's canvas skips what it skipped.
- **One visit, one render**: built here first in `GuestPreload`, then moved to ONE
  home in the batch join (rd/batch-2026-10-12): #6477's `public/sw.js` skips the
  preload of the sender's own address while its day-of copy is actually held, so
  the client keeps asking as before and the worker decides. A first visit and a
  personal link (`?k=`) still get their offline copy.
- NOT built: remembering same-for-everybody facts between visits; the Maker's
  canvas path.

SPEC IMPACT: None. No schema, no migration, no env switch, no copy. The 6 s /
10 s limits and which reads count as decoration are a session's choices, not
owner rulings.
