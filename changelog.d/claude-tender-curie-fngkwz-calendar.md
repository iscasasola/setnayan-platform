## 2026-11-17 · fix(supplier-dates): a refused read never says "saved" or "Told them"

From the supplier dashboard audit (Dates / Calendar):
- `ownedServiceIds` now returns `null` on a refused read. Before, it returned `[]`, so `editCalendar` unassigned every service on the schedule and said "Schedule saved". `createCalendar` made the schedule empty. `setServiceHalls` was unaffected, because it already stops on an empty id. Both callers now answer `save_failed`, and the delete in `editCalendar` checks its error.
- `movePoolCategory` no longer reads a refused count as 0, which had switched off a schedule that still held services.
- `notifyWaitlistSlot` uses the count `notifyWaitlistForFreedDate` returns. 0 now says "No one is waiting on that date yet", a throw says `save_failed`, and only a real count says "Told them".
- Guarded by `calendar/a-refused-read-never-saves.test.ts`.

SPEC IMPACT: None.
