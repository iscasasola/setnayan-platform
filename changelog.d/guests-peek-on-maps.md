## 2026-10-30 · feat(guests): a tap on the Map or the 2D plan peeks first — name · role · seat · Open (slice 6d)

Owner, Guests prototype v20 (`peekGuest`): *"Tapping a guest on Map / 2D / 3D shows a PEEK card (avatar · name · role ·
group · seat · Open); Open = the full guest card with Remove / Move-or-swap."* Until now a face opened the full card at
once, covering the map.

- ONE peek, `guests/_components/guest-peek.tsx`: face · name · one line (role · group · table/seat — what is known,
  nothing invented; "No seat yet") · **Open** (the brand step) · ✕. Words wrap, never cut.
- **Guests › Map**: a face tap peeks; the peek rises in the thumb row's seat (where a selected header's toolbar
  rises); Open = the List's card (`openCard`).
- **Seats › 2D**: a face tap with nobody picked peeks, in the seat plan's pop-up seat; Open = the shipped card with
  Remove · Swap. Seats › List still opens the card at once (its faces ARE the list); a tap while someone is picked
  still swaps (now asking first, slice 6a).
- The 3D room is not touched (view-only, its own builder — PR #7062).
- Guard `lib/a-tap-on-a-map-peeks-first.test.ts`.
- ⚠ Stacked on the swap-confirm PR (same `tapFace`). Merge after it.

SPEC IMPACT: None — builds the approved prototype's peek.
