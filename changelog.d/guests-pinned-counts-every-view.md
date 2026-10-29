## 2026-10-30 · feat(guests): the pinned top row carries its counts on every Guests and Seats view

Owner 30 Oct, with phone shots of Guests · Map, Seats · 2D and Seats · 3D, then Guests · List: *"Seat ls should be
pinned on top row and on map and 3d"* → *"Like this one"* (the List). Until now only Guests · List's pinned row carried
counts (✓ 80 ✕ 0 ? 152); Map, Seats · 2D and Seats · 3D showed only [view ▾] · ⋯ · ⚙.

- ONE face, ONE door shape (`PinnedSummary` + the small count door): **Guests (List · Map)** carry the reply doors
  ✓ ✕ ? (the same `pickReply` doors — the Map's Show is the List's); **Seats (List · 2D · 3D)** carry the plan's seat
  counts — 🪑 seated · unseated · ▦ tables. March carries none.
- The seat counts are the Seats count row's own (`seatedComing` · `unseatedComing` · `displayUnits.length` in
  `seating-editor.tsx` — coming guests, linked tables once), reported up the lens with the mode (`SeatsChannel.counts`,
  `registerSeats`); the screen never counts seats. A pressed count does what its tile does (Seated / Unseated → Seats ›
  List, Unseated opened; Tables → 2D).
- Stays pinned full screen (the full views already show the slim face from the start), one line at 390 (the counts
  give way inside the face, never wrap). The 3D room itself is untouched.
- Guard: `lib/guests-top-row-and-full-screen.test.ts` (5) — rendered for List · Map · March, source-pinned for Seats
  (sabotaged: Map dropped from the doors → red).

SPEC IMPACT: None — owner ruling relayed by the controller, 30 Oct.
