## 2026-11-25 · fix(area 7): A7-16 — the supplier's seat plan is the hosts' drawing

Final check (25 Nov), area 7, lane A (stacked on batch 3):

- A7-16: the supplier's Seats page (`/vendor-dashboard/clients/[eventId]/seat-plan`) now draws through the one seat-plan engine, as DECISION_LOG 2026-11-20 rules.
  - The map:
    - It reads the plan through `planFromSeating` and draws it with `PlanPoster`.
    - Real table shapes and sizes, with the hosts' removed chairs.
    - Chairs are filled to the seated count. No guest name reaches the supplier.
    - An unsized room is the engine's default room.
  - Joined tables:
    - On the map, they are spaced as one chain under the group's name.
    - In the list, they are one row (`groupTablesIntoUnits`, the hosts' display units).
  - The hand-drawn 9 % boxes are gone.
- `get_vendor_seat_plan` sends each table's `link_group_id` and `link_group_label`. This is migration `20271363442215`: CREATE OR REPLACE only, every gate unchanged.
- `PlanPoster` gains an optional `seated` count per table.
- The pure readings live in `lib/supplier-seat-plan.ts`.

Tests:
- `seat-plan/the-supplier-seat-plan-is-the-hosts-drawing.test.ts` (new).
- The A7-17 DB test now also holds the join.

SPEC IMPACT: None. The supplier now sees the hosts' own picture (DECISION_LOG 2026-11-20).
