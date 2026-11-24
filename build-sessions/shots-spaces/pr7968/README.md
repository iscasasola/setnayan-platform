# #7968 proof — 375 light · 375 dark · desktop (20 Nov, after the main catch-up)

Drawn by the dev lab `/dev/rooms-seating-lab` (the real `RoomsSeatingScreen` + shared `PlanMaker` over fixture rows).
A cloud session has no database and no sign-in, so these are fixture rows, not a real shop. The lab is wrapped in the
same `data-supplier-look` marker the `/vendor-dashboard` template adds.

| file | what |
|---|---|
| `rooms-*` | Show ▾ Hotel rooms: floors and their rooms, Add rooms |
| `halls-*` | Halls: the shop's room size + doors |
| `tables-grid-*` | Dining tables, Grid (every plan) |
| `tables-floor-*` | Dining tables, Floor plan (Pro: `?plan=pro`, picked from View ▾) |
| `refused-*` | a refused read says so, with Try again |

Dark fault found by these shots and fixed in this PR: Grid tiles were `bg-white` and empty chairs `fill-white`, so in
dark the words vanished on a white tile. Now `bg-raised` / `fill-raised` / `fill-cream`; guarded in
`app/_components/plan-maker/plan-maker.test.ts` ("dark mode: no surface is painted white").

Dark here is the EVENTS family (terracotta), not supplier navy: navy is PR #7997, not on main. Parity gap, not this PR's.
