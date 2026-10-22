## 2026-10-23 · fix(schedule): a schedule write that moves nothing says so — Running late, the floor's +N, responsible party, approvals

From the coordinator walk (owner, 23 Oct: "Keep what we have first and make them run smoothly"). RLS answers a refused
UPDATE with zero rows and no error, so these writers reported success over an unchanged schedule:

- **Running late** (`bulkRetimeScheduleBlocks`) and the **floor's +5/+10/+15** (`floorRetimeFrom`) now `.select()` each
  row they move and refuse an empty answer. The floor said "Moved 6 blocks." in green to a booked coordinator without
  Edit on the schedule; it now says nothing moved and why. A span with nothing to move is refused, not a quiet return.
- **Responsible party** (`setBlockResponsibleParty`) and an approved change (`resolveScheduleSuggestion`) read back too.
- **Maker:** the shift is a quiet write there (no render follows), so the rail kept the OLD times after the sheet
  closed. `ShiftSheet` now hands the landed times back (`onShifted` → `landShift`), laid on the rail at once.
- **A supplier's change in words only** (no new time, place or name): the sheet says "a note only — nothing on the
  schedule moves", and the supplier's notice says "They read your note — nothing on the schedule moved" instead of
  "Your proposed change is now on their schedule". One predicate, `isNoteOnlySuggestion` (`lib/schedule-ros.ts`).
- A template pressed on a stale screen (the schedule is no longer empty) redraws the page instead of doing nothing.
- Copy: "Guests see public blocks on the Event Hub" (was "their invitation site").

Guard: `app/dashboard/[eventId]/schedule/a-schedule-write-that-moves-nothing-says-so.test.ts`.

SPEC IMPACT: None (bugs in shipped flows; DECISION_LOG 2026-10-23 coordinator ruling recorded separately).
