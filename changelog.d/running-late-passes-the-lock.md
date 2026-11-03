## 2026-11-03 · fix(schedule): a host's Running late moves a supplier's locked moments; every other edit still meets the lock

- Owner, DECISION_LOG 2026-11-03 (2), verbatim: *"A host's RUNNING-LATE shift moves a supplier's moments even when that
  supplier has locked their times; the supplier still gets the notice."* #7198's change lock refused it; this closes the
  call that migration left open.
- Migration `20271303571970`: `running_late_shift_schedule(event, block ids, minutes)` — the Running-late sheet's one
  write. SECURITY INVOKER (the shipped RLS still decides who may move the day), a pure shift of exactly those minutes
  (start and end, durations kept), all or nothing. The moment-lock trigger passes a change only inside that function
  (a transaction-local marker the API cannot set) and only when it is exactly that shift with nothing else touched.
- `bulkRetimeScheduleBlocks`: the shift-notice path calls the door and skips the app-side lock check; a drag of one
  moment still asks the lock first and writes row by row as before. `notifyScheduleShifted` still tells every booked
  supplier, locked or not.
- Guards, both directions: `a-locked-part-refuses-the-host.test.ts` (the running-late branch uses the door and never the
  lock check; the drag path checks before it writes; the notice is not filtered by the lock) and
  `a-locked-part-refuses-the-host.db.test.ts` (a locked moment moves through the door and back; a plain shift, a rename
  riding a shift, a wrong size and a start without its end are refused; the marker does not outlive the call; a supplier
  or a span with a missing row moves nothing). Sabotaged twice (pass anything while late · no pass at all), both red.

SPEC IMPACT: None — the ruling is already in DECISION_LOG.md (2026-11-03); this ships it.
