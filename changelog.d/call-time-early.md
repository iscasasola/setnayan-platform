## 2026-11-16 · feat(schedule): Crew call apart from On site from; the call-time pin opens its control; hosts told in the app (owner ruling A + SCHEDULE MODEL)

**Owner ruling A (2026-11-16):** a supplier can set their call time right away. Cut 5 (merged 2026-11-14) already gave
the supplier's Schedule tab its Your times control when the hosts have no chapters.

- **The chat pin opens the control.** The supplier chat's amber "DUE NOW · Set your call time" pin had no body, so its
  "Answer ›" did nothing. It now opens "Set your call time", which goes to
  `/vendor-dashboard/clients/<event>?tab=schedule#own-times` (the control itself). The blocker button goes there too.
  Saving the times revalidates the chat, so the pin clears on the next read (`callTimeIsSet`, unchanged).
- **SCHEDULE MODEL (DECISION_LOG 16 Nov), rule 1:** the couple's Booked row draws "Crew call 6:00 AM · set by them" from
  the supplier's own `supplier_own_times.call_clock`, APART from the tagged-moment line, which is now
  "On site from 8:00 AM · <moment> · from your Schedule". The two are never one "call time". Once a crew call exists,
  the row stops saying "No call time yet". New reader: `readCrewCalls` (`lib/supplier-schedule-marks.server.ts`).
- **Rule 3:** when a supplier sets or changes their times, or presses Confirm my times, the hosts (the couple + The Day
  = Edit delegates, the same `scheduleRequestRecipients` rule) get an IN-APP notice: `notifySupplierTimes` on
  `schedule_suggestion`, which is on neither email list. Saving the same times again tells nobody.
- No migration. Arrive/done as real fields with a day are NOT in this PR (a schema change being drawn first).
- Guards: `apps/web/lib/the-call-time-is-set-early.test.ts`. The `schedule_suggestion` site register in
  `couple-supplier-notices-reach-email.test.ts` now counts 7 (the new in-app-only notice). The pinned `bookedView` shape
  in `your-team-phone-first.test.ts` admits `crewCalls`.

SPEC IMPACT: None from this PR (the SCHEDULE MODEL ruling was logged in DECISION_LOG 16 Nov by the controller).
