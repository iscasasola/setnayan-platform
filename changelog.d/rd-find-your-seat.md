## 2026-09-27 · feat(find-seat): find your seat, in the couple's theme — straight to your seat with a key, table-only without

`/[slug]/find-seat` rebuilt to the approved prototype
(`prototypes/find_your_seat_2026-09-27.html`, owner "ok to all", DECISION_LOG row
"FIND YOUR SEAT, REDESIGNED").

- **Theme, not chrome.** The generic Setnayan shell is gone; the page wears the
  couple's look through the layout's `GuestLookScope` (theme ground under its
  scrim, the theme's heading face, radius and ink), with the Vintage postmark
  and lace where the theme owns them.
- **A key holder never types.** The page asks the ONE resolver the event page
  uses (`resolveGuestViewer` via the new `readGuestViewerForEvent`): a guest
  cookie or a signed-in account bound to a seat lands on "Your seat" — A1 before
  the day, A2 on the day (fits one 390×844 screen), A4 "You're on the list" when
  not seated yet. Tablemates: own table only, first name + last initial
  (`publicDisplayName`, moved to `lib/find-your-seat.ts` and shared with `/seat`).
- **The door pass is free.** "Show at the door" opens a full-screen pass with the
  guest's own invitation QR (the one the desk already scans). Nothing on
  `/find-seat` asks for `CUSTOM_QR_GUEST`; the event page's seat link
  (`seatPassActive`) no longer asks either, and now opens `/find-seat`. The
  printed branded QR cards keep `/[slug]/seat` and its gate.
- **The open link reveals a table, never a name.** `/api/seat-lookup/[slug]`
  now answers `{ table_label, walk_* }` only (`openSeatMatches`), "not on the
  list" and "not seated" are ONE message, a failed RPC read is a 503 ("try
  again") instead of an empty answer that read as "no table", and a quiet
  per-device limit (10 a minute, `enforceRateLimit`) sits beside the old
  per-connection one. The search fires on the button, not per keystroke.
- **No new bar slot.** "Your seat · Table N →" in the Details scene, repeated in
  Me (`SeatDoorLine`). `WayfindingMap` gains an opt-in `look="theme"` and
  `faint`; every other caller draws exactly what it drew.

Guarded by `app/[slug]/find-seat/find-seat-is-free-and-private.test.ts` (14
sabotages, all caught) and a new case in `tests/db/seat-lookup-exact-match.db.test.ts`
(an unseated guest and a stranger's name get the same answer from the RPC).

⚠ Flagged, not changed: `public_seat_lookup` resolves only `event_type = 'wedding'`,
so the open search on a debut or christening seat page finds nothing (key holders
are unaffected — their seat is read directly).

SPEC IMPACT: None — implements the recorded DECISION_LOG row "FIND YOUR SEAT,
REDESIGNED" as written.
