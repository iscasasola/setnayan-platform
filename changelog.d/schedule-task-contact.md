## 2026-11-02 · feat(schedule): a task can carry a contact — a name and phone, seen only by the host and that moment's crew

The third of the owner's four schedule additions (DECISION_LOG 2026-11-02 "SCHEDULE FITS THE COORDINATOR'S TIMELINE
AS WRITTEN: 4 ADDITIONS" (3)). A real timeline writes "Bridal car — driver Mang Ben, 0917 …"; the driver is not a
supplier, and a task's who in words had nowhere to say how to reach them.

- Migration `20271303218631`: `event_schedule_task_contacts` — one contact per task (name + phone as written), RLS on
  at CREATE TABLE. Its own table because every booked supplier reads every task row; RLS is per row, so a column
  there would hand the driver's phone to the florist. The couple and schedule-Edit helpers write; a View helper reads;
  a booked supplier reads ONLY on a moment they are on (tagged, or holding a line of theirs), never on a staged block;
  anon and other accounts read nothing. `event_id` / `block_id` are derived from the task; deleting the task deletes
  the contact.
- Host: the moment sheet's task editor gains Contact · Phone on a person's task (never on a supplier's line); it saves
  when both are there, clearing both removes it (`contact_set`, through the schedule's own moment-op door).
- Supplier: their Schedule view shows "Contact: Mang Ben · 0917 …" on a moment they are on.
- Guest: "Your schedule" shows it (as text — never a tel: link, owner 2026-09-10) only on a moment they have a task on; never on an everyone line and
  never in the shared text. The service-role read is fenced in `yourSchedule`.
- Ugat: `event_schedule_task_contacts` joins J37 (block → tasks).
- Tests: `tests/db/a-task-can-carry-a-contact.db.test.ts` (5) · `app/dashboard/[eventId]/schedule/a-task-carries-a-contact.test.ts` (5).

No email, no notice: a contact is read where the day is read.

SPEC IMPACT: None (implements the 2026-11-02 ruling; no decision changed).
