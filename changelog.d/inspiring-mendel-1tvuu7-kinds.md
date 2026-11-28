## 2026-11-28 · feat(seating): table kinds are seater rules: Elders by the door, Spare never used (seat plan E)

Plan: specs `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.7 (table kinds E) and § 5. It is stacked on the engine PR (L11 PR 4). It is engine only, with no screens.

- **Elders tables:**
  - When the host made one, the elders (the grandparents of either side, `isElderRole`) are seated there first. Their +1s sit beside them.
  - Elders tables fill in this order (`elderTableOrder`): tables outside the speakers' reach first, then the table nearest a way out (the entrance or service door), then plan order.
  - An elder the Elders tables cannot hold goes on through the usual rules and is never left unseated.
  - With no Elders table, nothing changes (a test pins this).
- **Spare tables:** the seater has never used them (PR 4). Now the Guests list's seat hint (`suggestTableFor`) also uses the seater's rule (`autoSeatTakesTable`), so it never points a guest at a Spare or locked table.
- **The room:**
  - `seatRoomPoints(floorPlan)` holds the doors and the speakers.
  - `fetchFloorPlan` now reads the Speakers element (`speakers_enabled/x/y`) and the two ⋯ switches (`auto_seat_rsvps`, `seat_suggestions`). These come from the PR 3 migration; only an explicit false turns a switch off.
  - Every auto-seat run gets the room: auto arrange, lock-and-fill, the Guests list's "seat them", and the live re-seat.
- **Also:** PR 4's scope guard now expects the locked-table argument that auto arrange passes.
- **Every new column has a writer** (the controller's ask, 28 Nov). Both ride routes that already exist:
  - **Kind ▾ and the table lock** ride `updateTableLabel`'s table route: a form with `table_kind` (regular · vip · elders · spare, with `is_vip` in step) or `table_locked`, and no label.
  - **The Speakers element and the two ⋯ switches** ride `saveFloorPlan` (`seatPlanSettingsFrom`). They are written only when the screen sends them, so a stage save never turns the speakers off or a switch back on.
- **Tests:** `lib/elders-tables-sit-by-the-door.test.ts` (9) and `lib/seat-plan-settings-are-written.test.ts` (2). No migration and no new server action.

SPEC IMPACT: None (builds § 4.7 as planned).
