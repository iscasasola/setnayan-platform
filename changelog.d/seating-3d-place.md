## 2026-06-26 · feat(seating-3d): richer editing — pick a guest up, tap a table to seat them

Owner directive ("we want a seatplan that is interactive" → richer couple
editing). Replaces the old "tap a guest → auto-drop in the first free seat
ANYWHERE" with intentional, interactive placement: tap an unseated guest to
**pick them up**, then **tap the table** they should sit at — they take that
table's first free chair and walk in. Tapping the guest again puts them down; a
"Seat anywhere" button keeps the old auto-fill one tap away; a full table flags
"pick another". Reuses the existing reliable roster-tap + table-tap paths (in
Play mode a table tap was a no-op before), so it doesn't touch the table-drag.

- **`lib/seating-3d.ts`** — `firstFreeSeatAtTable(capacity, removedSeats,
  occupiedSeats)`: lowest free seat skipping removed + occupied, -1 when full.
  Pure + unit-tested; `sendGuest` now fills via it and takes an optional
  `preferredTableId` (returns whether it seated).
- **`seating-lab-3d.tsx`** — `placingGuestId` state; `onGuestTap` picks an
  unseated guest up; `onTableDown` seats the picked-up guest at the tapped
  table; HUD placement banner (Seat anywhere · Cancel) + roster highlight.
- **`lib/seating-3d.test.ts`** — +1 case (9 total) for `firstFreeSeatAtTable`.

SPEC IMPACT: 0008 Seating — 3D lab gains precise tap-to-place seating.
