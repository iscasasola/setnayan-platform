## 2026-11-02 · fix(dashboard): saves refresh in place · the Today line says what waits · a failed day-of read is said

From the event-dashboard audit (2026-11-02), items #6, #15, #7, #1 and #2.

- **Every schedule save refreshes Home, Planning and Schedule** (#6). The chapter and moment sheets no longer send the
  Maker's quiet flag (they never render in the Maker — the page reads no chapters there), and a task or march that saved
  now revalidates (`updateScheduleBlock`'s `moment_op` branch). `revalidateScheduleUnlessMaker` also refreshes
  Booked › Schedule (`/vendors`). The page behind the sheet re-renders in place; the sheet stays open.
- **The Requests sheet saves in place** (#15). `resolveScheduleSuggestion` and Approve all answer
  `{ ok, error }` (`lib/schedule-request-answer.ts`) instead of `redirect()`. One request's Decline · Approve / Noted is
  `RequestDecision`, which says a refusal under its buttons; Approve all says one at the sheet's foot. The legacy
  suggestions queue uses the same component.
- **The expense sheet never drops the last edit** (#7). Closing or unmounting within the 600 ms debounce now SENDS the
  waiting edit; a save that lands after close says a refusal as a toast.
- **Home's day-of grid says a failed schedule read** (#1). `dayOfBlocksFailed` reaches `DayOfModeGrid`; the banner,
  Happening now and Up next say "Couldn’t load the schedule · Reload", never "everything looks wrapped".
- **The Today line says what waits** (#2). `homeWaiting` reads the widgets' own facts — access asks, overdue payments,
  supplier changes to approve, quotes waiting on the couple — and they replace the calm line and the AI offer (never the
  picker's own firsts). A widget that could not be read means "Nothing waits on you" is not said. Access asks are read
  once (`readAccessAsks`) and shared by the Today line and its doorway.
- Guards: `every-schedule-save-refreshes-the-pages.test.ts`, `the-requests-sheet-saves-in-place.test.ts`,
  `the-last-edit-survives-close.test.ts`, `the-day-of-grid-says-a-failed-read.test.ts`,
  `the-today-line-says-what-waits.test.ts` (each sabotaged red, then restored). Re-pointed: `approve-all-is-every-change-you-saw`,
  `the-love-story-and-programme-are-instant`, `the-home-leads-with-one-next`.

SPEC IMPACT: None
