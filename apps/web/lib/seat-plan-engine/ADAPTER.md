> **Done, then superseded (20 Nov).** #7968 was switched onto this engine, then reworked into Spaces (owner 19 Nov):
> its page and storage became `app/vendor-dashboard/spaces/` and `lib/space-tables.ts`, and its tables and doors hang on a
> hall or room (migration 20271356372536). The paths below are the 18 Nov names, kept as the record of the switch.

# Switching PR #7968 (Rooms & seating, piece A) onto the shared seat-plan engine

Written 20 Nov 2026 for the session that owns
[iscasasola/setnayan-platform#7968](https://github.com/iscasasola/setnayan-platform/pull/7968)
(branch `claude/compassionate-cori-eyplct`). The ruling is DECISION_LOG 2026-11-20:
**"ONE SEAT-PLAN ENGINE FOR THE COUPLE AND THE SUPPLIER. ONLY WHO FILLS A SEAT DIFFERS."**
Owner: *"the need to run the same logic and code."*

The core your PR carries as `lib/plan-maker.ts` now lives in `lib/seat-plan-engine/` on `main`,
and the couple's Seat plan already runs on it. Your PR keeps its page, storage, migration, tile,
action and `PlanMaker` component. It stops carrying its own copy of the core.

## 1 · Merge `origin/main` into your branch, then resolve three files

| File | Conflict | Take |
|---|---|---|
| `apps/web/app/dashboard/[eventId]/seating/_components/seating-editor.tsx` | Both sides replaced the inline nearest-wall block with `nearestWall`. | **main's side.** It imports `nearestWall` from `@/lib/seat-plan-engine`, and its block is the same as yours. Delete your `import { nearestWall } from '@/lib/plan-maker';` line. |
| `apps/web/lib/plan-maker.ts` | No textual conflict. | **Delete the file** (`git rm`). Everything in it is in the engine under the same name. |
| `apps/web/lib/plan-maker.test.ts` | No textual conflict. | **Delete the file.** It now lives at `lib/seat-plan-engine/plan.test.ts`, with the two changes in §3. |

## 2 · Change imports: `@/lib/plan-maker` → `@/lib/seat-plan-engine`

Every name you import keeps its exact name and signature:

- `app/_components/plan-maker/plan-maker.tsx`: change the big import block (from `PLAN_MAX_CHAIRS` to `type PlanView`) to `from '@/lib/seat-plan-engine'`. Also take `CHAIR_PX` and `type TableGeometry` from there rather than `@/lib/seating`. They are the same objects, since `lib/seating` re-exports them.
- `app/_components/plan-maker/plan-maker.test.ts`: `import type { Plan } from '@/lib/seat-plan-engine';`
- `app/vendor-dashboard/rooms-seating/_components/rooms-seating-screen.tsx`: `import { planFromShopPlan, placementsChanged, type Plan } from '@/lib/seat-plan-engine';`

`planFromShopPlan` now takes a structural `ShopAreaPlan`, so the engine imports nothing from your
storage. Your `ShopPlan` from `shopPlanOf` already fits it field for field, so no call site changes.

## 3 · One behaviour change to expect, on purpose

**An unsized room is drawn 20 × 30 m, not 20 × 15.** `DEFAULT_ROOM` is now the couple's own free
board (`DEFAULT_ROOM_M`), so an unsized supplier area and an unsized event room have the same
shape ("one floor plan, one look").

- Re-shoot any 390 px screenshot of an unsized area.
- The ported test asserts `20 / 30`.

Line up's gap between tables is now the named `SLOT_GAP_PCT` (the couple's Auto-arrange gap). It
was a literal `3`, the same value, so nothing moves.

## 4 · Duplicate rules in `lib/rooms-seating.ts` to replace with engine calls

Your page still draws its tiles with its own copies of these rules. They are the same rules, so
replace them, and the tile and the floor plan can never disagree:

| Yours (`lib/rooms-seating.ts`) | Engine (`@/lib/seat-plan-engine`) |
|---|---|
| `chairPoints(shape, chairs, atEnds)` | `planTableGeometry({ kind: shape, chairs, chairsAtEnds: atEnds, … }).seats` |
| `shapeDrawn(shape, chairs, atEnds)` | `planDrawnShape({ kind, chairs, chairsAtEnds })`. Note it returns `'square'` the same way. |
| `tableWords(shape, chairs, atEnds)` | `planTableWords(table)` |
| `parseSide` / `MAX_SIDE_M` / `MAX_CHAIRS` | `parsePlanSide` / `PLAN_MAX_SIDE_M` / `PLAN_MAX_CHAIRS` (same 500 m and 60) |
| `naturalCompare` + `lineUp(units)` (the Grid's order) | `planTablesInOrder(tables)` |
| hand-checked "no two rooms share a name" in `actions.ts` | `duplicateNames(names)`. Keep the DB `UNIQUE` too: the check is for the words, the constraint is the truth. |

Keep `parseUnitNames` ("301-310 makes ten"), `moveStep`, `unitsOf`, the section words and
`countsLine` in your file: they are about your storage, not about a plan.

## 5 · What the engine adds that your page should use rather than rebuild

- **Floor plan is Pro and up.** Your page computes
  `floorPlanOpen = !vendorPaywallApplies(isTierAtLeast(tier, SUPPLIER_FLOOR_PLAN_MIN_TIER))` (the constant is `'pro'`).
  - Pass `planViewsFor('supplier', floorPlanOpen)` as `PlanMaker`'s `views`. That gives `['grid']` or `['grid', 'floor']`.
- **One check before a save:** `validatePlan(plan)` returns problems with their words (12 or fewer). Overlaps go through the couple's own placement oracle, so a supplier floor refuses exactly what an event floor refuses.
  - Run it in `roomsSeatingWrite` for `placeTable` and `lineUp`, and refuse the write when it reports an `overlap` or `outside`.
- **Floors** (`floors.ts`), for Hotel rooms once the 19 Nov "one floor plan, many floors" screen is built:
  - `setFloorPlanOn` ("Used on 2F to 5F");
  - `applyFloorPlan` (edit once; each floor numbers its own rooms; a booked room is held, never removed);
  - `makeFloorDifferent`;
  - `copyFloor`;
  - `roomNamesOnFloor`;
  - `nextGenericNames('room', …)` (Room001… on Verified and Plus);
  - `floorRangeWords`;
  - `floorPlanServesWords`.
- **Who fills a seat** (`occupants.ts`). This is the only difference between the sides:
  - a supplier plan is `side: 'supplier'`, and `canFill('supplier', …)` accepts a booking only, never a guest;
  - `fillNextSeat`, `fillWords('supplier', …)` ("6 of 10 booked") and `fillState` (Full · Has room · Empty) are ready for Step 5;
  - `coupleSeesOfBookings` gives a couple `{ available }` and nothing that names a table (owner, 18 Nov).
  - Until Step 5 opens, keep the occupant layer off (`showNames: false`), as your PR already does.

## 6 · Your checks after the switch

```bash
cd apps/web
git grep -n "lib/plan-maker" -- . ':!*.md'      # must print nothing
npx tsx --test lib/seat-plan-engine/plan.test.ts lib/seat-plan-engine/engine.test.ts app/_components/plan-maker/plan-maker.test.ts lib/rooms-seating.test.ts
pnpm preflight --only guards,lint,types,pins
```

`engine.test.ts` also fails if a second copy of the table geometry appears anywhere it checks.
Don't fork the couple editor and don't copy a rule out of the engine. If the supplier side needs
a rule changed, change it in the engine, where both sides get it.

## 7 · For PR #8057 (the round-two floor, stacked on #7968)

[iscasasola/setnayan-platform#8057](https://github.com/iscasasola/setnayan-platform/pull/8057)
(branch `claude/seat-plan-floor-redesign`) grows `lib/plan-maker.ts` with the round-two grid.
This engine deliberately does **not** carry a second row algorithm, so the grid has exactly one
home. When #8057 merges `origin/main`:

1. Do §1–§2 above (it carries #7968's files).
2. Move its grid section into **`lib/seat-plan-engine/rows.ts`** unchanged, and add `export * from './rows';` to `index.ts`. That section runs from `GRID_GAP` to the end of `lib/plan-maker.ts`:
   - `GRID_GAP`, `GRID_ROW_GAP`, `GRID_LO`, `GRID_HI`, `GRID_TOL`, `GRID_SNAP_TOL`;
   - `gridFrame`, `centredRun`, `gridRows`, `onGridRun`, `joinRow`, `gridLayout`, `snapToLines`, `fitRoom`, `planRoomWords`;
   - `seatingFloorOf`, `seatingBoxPct`, `seatingJoinRow`, `seatingGridLayout`.
3. Point its spacing at the engine's names instead of new literals:
   - `GRID_GAP = SLOT_GAP_PCT`;
   - `GRID_ROW_GAP = ROW_GAP_PCT`;
   - `GRID_LO = TABLE_BAND_PCT.lo`;
   - `GRID_HI = TABLE_BAND_PCT.hi`.

   These are the values it already uses (3 · 4 · 10 · 90), and `computeAutoLayout` reads the same names, so the couple's Auto-arrange, the supplier's Line up and the new grid can't drift apart.
4. Change the editor's and `seating/actions.ts`'s `@/lib/plan-maker` imports to `@/lib/seat-plan-engine`. The engine already holds those files' geometry imports. Keep the one import block per file that this PR left.
5. Move `lib/plan-grid.test.ts` to `lib/seat-plan-engine/rows.test.ts`.

"Still on the grid" stays as #8057 built it, read from where a table stands with no column. The
engine has no `pinned` flag on purpose, so the two can't disagree.
