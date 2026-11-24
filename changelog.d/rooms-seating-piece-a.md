## 2026-11-18 · feat(supplier): Rooms & seating — the shop's rooms, halls and tables, made once (piece A)

Shop › Makers › Specialized tools gains a **Rooms & seating** tile (`/vendor-dashboard/rooms-seating`), filling the
`floor_plan` + `tables_and_seating` hub keys. One `Show ▾` dropdown: **Hotel rooms** (floors and their rooms; "301-310"
makes ten) · **Halls** (the shop's shipped Room size, `vendor_profiles.venue_width_m/length_m`, plus doors: Main or
Service · wall · where along it) · **Dining tables** (areas with an optional size and doors; tables Round · Long with a
"Chairs at the ends" switch · Half-moon booth, one chair count each).

Storage: migration `20271350389612_shop_rooms_and_seating.sql` — `vendor_unit_groups`, `vendor_units`
(with `x_pos/y_pos/rotation_deg` in `event_tables`' sense, for the shared seat-plan core), `vendor_unit_doors`. RLS at
create: the shop's team reads, admin/owner seats write, anon nothing, **no couple policy** (couples never see which room
or table). A guard trigger keeps a room on the shop's own floor and a table/door on its own area. DB test
`a-shops-rooms-and-tables-are-its-own.db.test.ts`; pure lib `lib/rooms-seating.ts` (+ test). All writes go through ONE
server action (`roomsSeatingWrite`), so the action budget rises by one.

The drawn plan (Grid · Move · Line up · tables on a sized room) is the SHARED seat-plan core another session is pulling
out of the couple seat plan (owner 18 Nov); this page hands it `shopPlanOf(...)` and draws no editor of its own.

SPECS: `prototypes/units_rooms_seating_2026-11-18/MAP.md` piece A; DECISION_LOG 2026-11-18 rows (ruling 35, "REUSE IT",
"NOTHING NEW").
SPEC IMPACT: specs `prototypes/units_rooms_seating_2026-11-18/STEP5_SPEC.md` (new — pieces B, C, D, spec only) and a
FEATURE_REGISTER row for the route.

## 2026-11-21 · refactor(rooms-seating): on the one seat-plan engine (ADAPTER.md)

Caught up with `main` (merge only). Per `lib/seat-plan-engine/ADAPTER.md` (DECISION_LOG 2026-11-20 "ONE SEAT-PLAN
ENGINE"): `lib/plan-maker.ts` + its test are gone — the PlanMaker and the page import `@/lib/seat-plan-engine`. The
tile's rules (`tableWords`, `shapeDrawn`, `parseSide`, the 60-chair and 500 m limits) call the engine, so the tile and
the floor plan cannot disagree ("Long · 10 chairs · 2 at the ends", the engine's words). The floor view is offered by
`planViewsFor('supplier', open)` at `SUPPLIER_FLOOR_PLAN_MIN_TIER`, and a table's Move runs `validatePlan` first —
a supplier floor refuses the same overlap / outside an event floor refuses. An unsized area is now 20 × 30 m.

SPEC IMPACT: None (implements the 2026-11-20 ruling).
