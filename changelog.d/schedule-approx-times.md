## 2026-11-02 · feat(schedule): a moment's time as written — "About 3:15 PM" or "2:15/2:30 PM"

The second of the owner's four schedule additions (DECISION_LOG 2026-11-02 "SCHEDULE FITS THE COORDINATOR'S TIMELINE
AS WRITTEN: 4 ADDITIONS" (2)). A real timeline writes "Bridal car leaves 2:15/2:30" and "Entourage 3:15/3:20"; the
schedule could only hold one exact clock. Stacked on the first addition (right-after moments): both live in the same
When ▾ dropdown and the same clock-words helper.

- Migration `20271303051692`: `time_shape` ('at' default for every row · 'about' · 'or') and, on 'or',
  `time_or_minutes` — the second time as minutes after the start (1–240), never a second clock, so Running late, the
  date move, a chapter move and a right-after anchor carry it. `start_at` stays the earliest time written, so a reader
  that does not know the shape still draws a true clock. Refused: an unknown shape, an 'or' without a second time, a
  second time on anything else, a shape on a Time-TBA / right-after row.
- ONE place makes the words: `timeAsWritten` (`lib/time-shape.ts`), called through `momentClockWords` — the host's run
  of show, the guest's "Your schedule" and the supplier's Schedule view all say "About 3:15 PM" / "2:15/2:30 PM"
  ("11:45 AM/12:00 PM" across noon).
- Moment sheets: When ▾ = At a time · About a time · One of two times · Right after the one above (one dropdown). One of
  two adds an "Or at" time row; moving the first time keeps the second where it was written.
- Tests: `tests/db/a-moment-time-can-be-about-or-either.db.test.ts` (4) · `app/dashboard/[eventId]/schedule/a-moment-time-is-as-written.test.ts` (6).

⚠ For the controller: the guests' Event Hub schedule and the PDF still print the first time only (true, not as
written) — said here, not changed. #7198's `PART_FIELDS` / lock tuple should also list `time_shape` and
`time_or_minutes` once both are in.

SPEC IMPACT: None (implements the 2026-11-02 ruling; no decision changed).
