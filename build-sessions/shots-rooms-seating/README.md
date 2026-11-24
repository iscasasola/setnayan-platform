# Rooms & seating — 390 px shots (PR #7968, piece A)

Now beside Proposed:
- `now-beside-proposed-shop-tools-390.png` — Shop › Makers › Specialized tools. Now: the carousel ends at 3D plan. Proposed: a **Rooms & seating** tile at the end, which opens the page.
- The page itself is new. **Now** = `/vendor-dashboard/rooms-seating` does not exist (no door, no page).

Proposed: the page, drawn by the dev lab `/dev/rooms-seating-lab` (the real `RoomsSeatingScreen` over sample rows, with no database):
- `proposed-rooms-390.png` — Show ▾ Hotel rooms: floors, their rooms, Add rooms ("301-310" makes ten).
- `proposed-halls-390.png` — Halls: the shop's own Room size (the shipped `vendor_profiles` size), plus doors (Main or Service · wall · where along it).
- `proposed-tables-390.png` — Dining tables: an area with its size and doors; tables Round · Long with ends · Half-moon booth · a small Long drawn square; Add tables.
- `proposed-table-edit-390.png` — a table opened: name, area, type, chairs, chairs at the ends.
- `proposed-refused-390.png` — a refused read says so, with Try again. It never says "no rooms yet".

The drawn plan, folded in from #7969 (18 Nov): each dining area now draws its tables with the shared `PlanMaker`.
- `now-beside-proposed-tables-floor-plan-390.png`. Now: the Dining tables section had rows only. Proposed: a Pro shop (`/dev/rooms-seating-lab?show=tables&plan=pro`) gets the drawn Floor plan of the area at its Wide × Deep, with the main door on its wall, Line up, and drag to move. The rows below are unchanged.
- `now-beside-proposed-tables-grid-390.png`. Every other shop gets Grid, with Floor plan greyed in the View dropdown ("On Pro, Max and Ultra").
- The plan maker's own shots (read-only with one table marked, the table sheet, Line up) are in `build-sessions/shots-plan-maker/`.
