## 2026-09-29 · feat(maker-details): Details part 4 — the Seat plan moves into Details, in the three parts, behind one door

Implements DECISION_LOG 2026-09-28 "THE SEAT PLAN MOVES INTO DETAILS AND WEARS
THE THREE COLUMNS", 2026-09-29 "THE SEAT PLAN IS LIVE BEHIND ONE DOOR — GUESTS
SEE THIS NOW", "OWNER ANSWERS — NINE PENDING DECISIONS" (8: a switch to hide
seats again), "A TOOL MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS",
"3D SEAT PLANNING STAYS FREE" and "THE GUEST LIST KEEPS PEOPLE…" (Arrange the
room leaves the Guest list with this part). Stacked on `rd/details-your-event-2`.

**Details › Your event › Seat plan** (the last item of Your event; only where
the event type has a seat plan — its profile's `seating` surface, the seat
rooms' own rule). The SAME seating editor (`seating-editor.tsx`: its state,
handlers, actions, lock, presence, live refresh, dock, dialogs) — only its
shell is re-split (`details` prop; absent, the standalone page is unchanged):

- **Left — the place.** Every table ("6/8 seats · Round"), then the elements on
  the plan (stage, dance floor, entrance/walk-through, service door, cocktail
  area, each booth, each sign) as the navigator's pieces (`seatPlanPlaceRows`).
  A row selects the object on the plan; a tap on the plan picks the row; a guest
  or group picked on the right is SEATED by tapping a table row.
- **Middle — the plan.** The one command bar (List · 2D · 3D, Add, Auto Arrange
  split, Share & print, save chip), the banners, the canvas, the table dock.
  **3D** is the shipped lab page streamed into this same part (`?seat=3d`) —
  free, never a page away; the 2D editor stays mounted under it, and the lab
  does not release the person's lock on close (`useSeatingLock` `releaseOnUnmount`).
  Coming back re-reads the plan and the floor follows it while nothing is unsaved.
- **Right — the guests** (`seatPlanGuestSections`): search, Only unseated,
  **Unseated · N first** (a guest who declined is counted, never "left to
  seat"), then the seated by side — the event type's own words — or by group
  where there are not two named people; **Seat at… ▾** (the shared PickMenu,
  tables with room only) on every unseated guest; a picked table shows ONLY its
  guests and empty seats (tap an empty seat → the picked guest, else the next
  unseated), **+ Seat next unseated**, Unseat, All guests; the Rules pane and the
  new-table panel open here too. On a phone the table's dock is drawn IN the
  flow at the top of this part (`ContextDock` `inline`), never fixed over the Maker.
- **"Guests see this now"** — one switch above the plan: on = `publishSeating`,
  off = the SHIPPED `unpublishSeating` (the 3D Plan's switch; clears
  `event_floor_plan.published_at`, the one gate Find your seat, the seat pass
  roster and the 3D walk read). **+0 server actions.** Printing the table signs
  switches it on too. Saves immediately; Apply does not cover it (said in its ⓘ).

**The Indoor Blueprint's home is the Seat plan** (owner-approved 2026-09-29, via
the controller: "it's the same room"): a **Guests' map** piece in the navigator
opens the shipped `BlueprintStudio` in the right part — the entrance handle and
each seated guest's "find your table" map, drawn from the plan's own tables
(its `saveEntrance` writes the same `event_floor_plan` entrance the plan's
Entrance marker reads; the plan re-reads it after a save). `/studio/indoor-blueprint`
lands the couple of an Event Hub event with a seat plan on it (`?seat=map`);
Our Services counts it as gone home (`TOOL_HOMES`).

**Doors:** `/seating` lands the couple of an Event Hub event on the item
(`detailsIsTheDoor`; `?view=list` → `seat=list`); a coordinator or a type with
no Event Hub keeps the page. **Arrange the room left the Guest list** (`rosterDoors`).

Pure rules in `lib/seat-plan-details.ts`; guards in
`lib/the-seat-plan-moves-into-details.test.ts` (each fails under sabotage).

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — one AS BUILT row for Details part 4.
Flagged for the owner: the approved "+1 server action" to hide seats was NOT
built — `unpublishSeating` already ships and is the gate; `qr_published_at`
(which that row also asked to null) gates nothing a guest reads and is left
alone by design (printed signs keep working).
