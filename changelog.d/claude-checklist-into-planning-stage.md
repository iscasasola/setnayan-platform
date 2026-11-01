## 2026-11-01 · feat(planning): the Checklist merges into Planning Stage — one lead-up list

Owner ruling 1 Nov (DECISION_LOG "CHECKLIST MERGES INTO PLANNING STAGE"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §9).

- Planning Stage (`lib/preparation.ts` · `fetchPreparationAgenda`) now carries the Checklist's template tasks in the same dated list. Each task has a real date: the template's (event date − offset, runway-compressed, same anchor as before) until the host moves it (new `event_checklist_items.due_date_set`); "Back to the plan's date" undoes a move. A before-the-day task cannot be moved past the event day.
- Tasks keep auto-ticking: the schedule page runs `ensureChecklistSeeded` (top-up + reconcile, never un-ticks) before its one read.
- Hand-added `event_preparation_items` rows gain a done tick (new `completed_at`).
- A task and the autofill row that is the same work show once (`lib/planning-twins.ts`): statutory windows, paperwork, confirmed meetings and a supplier's first payment line fold into their open task.
- One list: Home's To do tile, the events board, "Events you run" and the Overview chip all count Planning Stage's To do filter with `planningProgress`; `fetchChecklistProgress` / `fetchChecklistItems` / `checklistOverdueCount` are gone.
- `/dashboard/[eventId]/checklist` forwards to `schedule?view=preparation&filter=todo`; Planning Stage gains an Everything · To do dropdown.
- One server action (`planningRowAction`: tick a task, tick a step, move a task) replaces `toggleChecklistItem` — the route budget is unchanged.
- Migration `20271300250517_checklist_into_planning_stage.sql` (two nullable columns, RLS unchanged).
- Guard: `lib/the-plan-is-one-list.test.ts`.

SPEC IMPACT: None — implements the 2026-11-01 ruling as recorded. Not built, for the owner: Meet-up (no meaning defined yet); the old Checklist page's side cards (budget health, "you might also want", supplier progress) have no home in Planning Stage.
