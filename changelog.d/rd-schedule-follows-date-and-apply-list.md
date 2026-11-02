## 2026-10-04 · feat(maker): a moved date moves the whole schedule · the Apply sheet names each change

Two owner-approved follow-ups to train e (#6327 · #6329), DECISION_LOG 2026-10-04
"CHANGING THE EVENT DATE MOVES THE WHOLE SCHEDULE · THE APPLY SHEET NAMES EACH CHANGE".

- **(a) The whole Schedule follows the date** (owner: *"Yes if possible"*). When Apply
  writes a new event date, `moveScheduleWithDate` (`lib/ceremony-time.server.ts`)
  moves EVERY `event_schedule_blocks` row of the event — every type, parents and
  parts — by the same number of days, each keeping its wall-clock time
  (`wallClockDayShift` · `shiftWallClockDays`, `lib/schedule-datetime-local.ts`'s
  round-trip rule). Runs in the couple's own session (RLS as today), asks each row
  back, never creates or deletes a block; the typed ceremony time is placed after
  it (`placeCeremonyBlock`, no longer dragging the ceremony alone). No move when the
  old or new date is not one exact day (`exactDayOf` — one rule for both). Pressing
  Apply again is a no-op (the live date is already the new one). A failed move is
  said plainly ("Your new date is live, but some Schedule times stayed on the old
  day…") — Apply again cannot finish it.
- **(b) The Apply sheet names each change** (owner: *"Yes"*). "Ready to apply" now
  lists up to eight lines — "Look · Buttons", "Event Details · Ceremony time",
  "Schedule · Background, Animation" — then "+ N more"; a Pro line keeps its ◆.
  ONE reader: `hubDraftCountedChanges` (`lib/hub-draft.ts`) is the walk the badge
  count makes; `hubDraftChangeLines` (`lib/hub-draft-change-lines.ts`) names those
  same entries, so the list and the number cannot disagree. Built server-side into
  `HubDraftSummary.changes`; the sheet only renders strings and writes nothing.
- Tests: db 5–9 in `tests/db/venues-and-ceremony-time-wait-for-apply.db.test.ts`;
  `lib/a-moved-date-moves-the-whole-schedule.test.ts`;
  `website/_components/the-apply-sheet-names-each-change.test.ts`.

SPEC IMPACT: DECISION_LOG 2026-10-04 "CHANGING THE EVENT DATE MOVES THE WHOLE SCHEDULE · THE APPLY SHEET NAMES EACH CHANGE" — built (a BUILT row added beside it).
