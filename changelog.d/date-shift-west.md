## 2026-08-04 · fix(dates): your wedding no longer shows a day early to family abroad

A wedding date is a calendar day — 12 December is 12 December, everywhere. The
app was treating it as a moment in time instead, and a moment that happens at
midnight in one place has already been *yesterday* somewhere else. So to anyone
reading from the Americas or Europe, a 12 December wedding said **11 December**.

It was on the save-the-date card, on the invitation, and everywhere else a date
appears — 41 screens through one shared piece of code, plus the compact date on
the save-the-date. Nobody testing from the Philippines could see it, and neither
could the automated checks, which run on a clock where the mistake happens to
cancel out.

For a Filipino wedding this is not a small thing. The relatives most likely to be
reading a save-the-date on a foreign phone are exactly the ones booking flights.

Two more places carried the same mistake:

- **The seeded day plan** for birthdays, debuts, christenings and tournaments
  landed every moment on the day *before* the event for anyone outside the
  Philippines.
- **The planning checklist** could hand a couple a task dated before their plan
  existed, by reading "when this plan was created" on the reader's clock instead
  of the venue's.

All of it now reads the date as a date. The whole test suite runs in four
different world timezones and passes in all of them — the first time that has
been true.

SPEC IMPACT: None.
