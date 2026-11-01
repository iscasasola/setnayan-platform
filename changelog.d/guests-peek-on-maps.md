## 2026-10-30 · feat(guests): a tap on the Guests Map peeks first — name · role · seat · Open (slice 6d)

Owner, Guests prototype v20 (`peekGuest`): *"Tapping a guest on Map / 2D / 3D shows a PEEK card (avatar · name · role ·
group · seat · Open); Open = the full guest card with Remove / Move-or-swap."* Until now a face opened the full card at
once, covering the map.

- ONE peek, `guests/_components/guest-peek.tsx`: face · name · one line (role · group · table/seat — what is known,
  nothing invented; "No seat yet") · **Open** (the brand step) · ✕. Words wrap, never cut.
- **Guests › Map**: a face tap peeks; the peek rises in the thumb row's seat (where a selected header's toolbar
  rises); Open = the List's card (`openCard`).
- **Seats › 2D does not peek** (owner 2026-11-01, DECISION_LOG "SEATS 2D IS THE ROOM, LIST IS THE PEOPLE" — it
  supersedes the prototype's 2D peek): 2D is for moving tables; the 2D face's new behaviour comes with the Seats
  follow-up (S1). Seats › 2D and List keep what the swap-confirm slice gave them.
- The 3D room is not touched (view-only, its own builder — PR #7062).
- Guard `lib/a-tap-on-a-map-peeks-first.test.ts`.
- ⚠ Stacked on the swap-confirm PR (same `tapFace`). Merge after it.

SPEC IMPACT: None — builds the approved prototype's peek.
