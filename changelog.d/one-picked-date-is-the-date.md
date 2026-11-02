## 2026-10-08 · fix(onboarding): one picked date is the date

A hangout created with ONE date showed no date on the Home cover: the generic
onboarding (`lib/onboarding/event-insert.ts`) wrote `event_date: null` +
`date_candidates: [d]` even for a single pick, and Home reads `event_date`.

- **Write:** for a type `lib/event-anchor.ts` marks `fixed_date` + `input`
  (`isFixedDateInputType` — graduation · reunion · corporate · gala_night ·
  celebration · simple_event · date · hangout · wake), exactly one pick now writes
  `event_date = d`, `event_date_precision = 'day'`, `date_candidates = null` — the
  same as `onboarding/simple`. Two or more picks keep the candidate flow. Weddings
  (`none` · `output`) and the fallback anchor for unknown types are untouched.
- **Read (existing events, no migration):** `withPickedDate` reads an old row's
  one candidate as its date on Home (`app/dashboard/[eventId]/page.tsx`) and the
  Event Hub cover (`loadEventShell`).
- Test: `lib/onboarding/one-picked-date-is-the-date.test.ts`.

SPEC IMPACT: None. (A data backfill of stuck rows is an owner decision — it needs a migration.)
