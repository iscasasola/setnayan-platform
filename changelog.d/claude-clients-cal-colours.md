## 2026-11-15 · feat(supplier): the Clients calendar takes the new seat colours — colours only (CLIENTS-CAL)

Owner ruling 2026-11-14 (corpus `DECISION_LOG.md`, "THE CLIENTS CALENDAR KEEPS WHAT IT HAS — ONLY THE COLOUR CODING
CHANGES"): *"use what we have on the app already. we just wanted to fix the color coding."* The supplier's month
(`CalendarGrid mark="box"`, drawn only by `customers-calendar.tsx`) keeps every shipped mark — the booked / outside /
asking dots, the struck number for not available, the bold number for full, today's ring, the one ink box for the
picked day, its legend, the Schedule chip and the week strip. What changes is the fill: a day that can still take a
booking is a filled seat-green seat (`--seat-top` / `--seat-ink`, the ONE token set Check a date uses); a day that
cannot (blocked, full, refused, or already past) is an outlined near-white seat (`--seat-out` / `--seat-out-line`,
new tokens beside the seat set; light values from the ruling, dark reusing the dark seat-off ground + hatch tone).
The `calendar-day-box` guard's "#28 only the picked day is filled" is restated on the ruling: the only fill a day may
wear is a seat token — never the accent, ink, a hatch or a hand-typed colour. Circle calendars are untouched.

SPEC IMPACT: None — implements the 2026-11-14 ruling already in the corpus.
