## 2026-11-02 · feat(schedule): CHANGE LOCK — a supplier locks their part; the host's later change is refused

Supplier gate audit D7 (DECISION_LOG 2026-11-02 "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK" (7), owner: *"change
lock (means the supplier cannot accept changes anymore)"*). Built on G6 (#7190, the host sees "Times confirmed") and
D6 (#7196, the supplier hears changes) — this branch carries both until they merge.

- Supplier: "Lock my times" / "Unlock" on their schedule for the event (`supplier-schedule.tsx`), one line + ⓘ, through
  the existing `supplier_mark_schedule` door (new marks `lock` · `unlock`, any time). Their own Suggest still works.
- Database (migration 20271303409352): `event_supplier_schedule_marks.locked_at`; BEFORE triggers on
  `event_schedule_blocks` (UPDATE/DELETE) and `event_schedule_tasks` refuse a change to a locked shop's moments or crew
  lines from ANY door with "<shop> isn't taking changes. Send them a request instead." Passes, by data signature: guests-only
  toggles and order; another supplier put on a shared moment; the supplier's own open request applied exactly as
  asked; the event's date moving; the event being deleted.
- Host: the four schedule actions (`updateScheduleBlock` incl. `move_schedule_chapter`, `deleteScheduleBlock`,
  `setBlockResponsibleParty`, `bulkRetimeScheduleBlocks`) refuse BEFORE writing (`lib/supplier-part-lock*.ts`); the
  moment's supplier line reads "· Not taking changes", the Team row "Not taking changes · <day>", and a refused save
  (rail or moment sheet) says the calm line. Host and coordinator screens never say "lock" (a couple reads "book",
  never "lock"); only the supplier's own button and state keep the owner's term "Lock my times" / "Locked".
- Guards: `lib/a-locked-part-refuses-the-host.test.ts` (rule + each action + host/supplier wiring) and
  `tests/db/a-locked-part-refuses-the-host.db.test.ts` (both refuse paths through real sessions). Exposure baseline +1
  column (`locked_at`, read under the existing row policies). Ugat RUNOFSHOW node text names the lock.
- Not a request yet: host → supplier requests are audit D2 (not built); the calm line says "send them a request".

SPEC IMPACT: None (implements the 2026-11-02 ruling). Owner calls flagged in the PR: does Running late pass a lock
(today: no); may a supplier lock before the final week (today: yes).
