## 2026-11-27 · feat(seating): tables name themselves after their majority group (seat plan L11 PR 3, 🟠 migration)

The owner's ruling R6 (27 Nov): "the majority of who is seated there if it has a group will be the table's name". Plan: specs `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.3 and § 6. The behaviour follows the approved clickable prototype `prototypes/seat_table_flow_2026-11-27/index.html`.

- **The migration** (`20271365089548_seat_plan_table_names_kinds_locks.sql`, the seat plan's one migration). It adds columns on existing tables only, with no new table or policy:
  - `event_tables.label_is_auto`, backfilled false for every label that isn't the default `Table <n>`, so every name a couple typed is kept
  - `event_tables.table_kind` (regular · vip · elders · spare), backfilled `vip` from `is_vip`
  - `event_tables.locked`
  - `event_floor_plan.speakers_enabled` / `speakers_x` / `speakers_y` (the `entrance_*` pattern)
  - `event_floor_plan.auto_seat_rsvps` / `seat_suggestions`
- **The one reader:** `lib/table-auto-name.ts` › `tableDisplayNames`. Its rules:
  - A host name is kept as typed.
  - Otherwise, the group holding more than half the seated seats names the table. A +1 counts under their guest's group.
  - Otherwise, the table keeps "Table N".
  - Clashes take " 2", " 3" in plan order.
  - A host name another table already shows is refused (`hostNameClash`).
  - The server half is `lib/table-auto-name.server.ts`. A refused read throws; a name is never guessed.
- **Every name surface reads it:**
  - the 2D plan's badges (`planTableBadges` takes the shown names)
  - the caterer sheet
  - the signs, escort and place cards
  - the entrance chart
  - the A3 plan
  - `/[slug]/seat`, find-seat and find-my-table
  - the open name search (`/api/seat-lookup/[slug]`)
- **The Name row** (`seating/_components/table-name-row.tsx`) shows the box with the auto name as its placeholder, a "why" line ("Auto · 9 of 10 seated here are Reyes family"), "Use the auto name · <name>", and Save. In the editor it opens from ⋯ › Name…. An empty name returns the table to auto.
- **The writers:**
  - `updateTableLabel` writes `label_is_auto` and re-checks the clash.
  - `createTable` and the auto arrange inserts write `label_is_auto` from the label.
  - The VIP switch writes `table_kind` beside `is_vip`.
  - `fetchTables` reads the VIP mark from `table_kind` (`isVipTable`).
- **Review fixes (27 Nov, controller):**
  - **A name field that was only tapped never renames.** `renameWrites` returns "none" when the text is the stored label or the shown name, in the editor and in `updateTableLabel`. Every name field is pre-filled with the shown name.
  - **Every other surface now reads the shown name** through `readShownTableNames` / `shownTableRows`:
    - the hub print's tickets and the guest pass;
    - the reminder email's table line (same words, no new email);
    - the door desk and the day-of head table card;
    - the coordinator's and crew's QR lookup (a failed name read is a failed lookup);
    - the guest's Event Hub line, the story's room and the 3D walk caption;
    - the walkthrough manager and the Patiktok booth;
    - the guest card, the decline Undo line, souvenirs and Guests › seats;
    - the share and export files, the hub-print registry and change requests;
    - every name in the editor (headings, notices, the phone dock, the list rows).
  - **A guard fails any new `table_label` select** that bypasses the reader.
  - **Linked tables are one unit:** one shared auto name read from all their seats, and a rename sets the flag on every member.
- **Server actions:** no new export. No email.

SPEC IMPACT: None. It builds the approved plan (DECISION_LOG 2026-11-27 "Seat plan: the table-first flow is approved…"). One deviation is in the PR body: the speakers columns are `speakers_x` / `speakers_y`, after the `entrance_x` pattern the plan names, not `*_pct`.
