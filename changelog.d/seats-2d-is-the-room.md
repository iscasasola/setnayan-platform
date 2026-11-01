## 2026-11-01 · feat(seats): 2D is the room — a table tap only selects it, one slim bar of its verbs; a booth opens its supplier's card; a +1's "+2" (S1a)

Owner 2026-11-01, DECISION_LOG "SEATS 2D IS THE ROOM, LIST IS THE PEOPLE" (*"this makes it impossible for me to move the
table"*) and "SEATS: WHAT EACH VIEW DOES" (*"tapping a 2D booth opens the supplier card"*). Guests › Seats › 2D:

- A tap on a table only SELECTS it (drag to move). Its verbs are ONE slim bar in the thumb row — **Rotate · Shape ▾ ·
  Seats − N + · ⋯** (Name… · Swap with another table… · Link… / Unlink · Delete) — the shipped handlers, nothing new
  writes. The full table sheet / dock no longer opens over the map.
- No guest list and no guest editing in 2D: the guests column is not drawn (an empty column takes no room), the filter's
  "People" door is gone, a table pick raises no people sheet; a name or an empty seat does nothing for the guest — the
  press is the table's, so a table moves from anywhere on it. Seats › List keeps the people (its rebuild is S1c).
- A booth a booked supplier runs opens the 3D walk's supplier card (`BoothVendorCard`, "View" — they booked them),
  mapped by `lib/booth-card-from-row.ts` (public business identity only; the 2D card shows initials, not the logo,
  because the row's logo is a raw stored ref).
- A guest's second +1 reads "Antonio’s +2" (seat plan hint, guest card sentences), never "+1" under "+2 · TBA".
- NOT here: the guest-side WayfindingMap's booths (the guest seat pages draw no booths today — a guest-safe read is its
  own step); the other markers (stage, dance floor, signs) keep their dock.
- Guards `lib/seats-2d-is-the-room.test.ts` · `lib/a-second-plus-one-says-plus-two.test.ts`.

SPEC IMPACT: None — builds the 1 Nov rulings already in DECISION_LOG.
