## 2026-10-23 · feat(schedule): a shift of the day tells every booked supplier — "Schedule moved +30 min from 4:00 PM"

Owner, tracker 2026-10-23: YES. When the couple shifts the schedule — Running late on the couple's schedule, or the
day-of floor's +N — every booked supplier on the event gets ONE in-app notice (never one per block; no email):
"Schedule moved +30 min from 4:00 PM", opening their event Hub's schedule.

- New notification type `schedule_shifted` (migration `20271284540209`, a bare `ADD VALUE IF NOT EXISTS`), label
  "Schedule moved", declared app-only in `lib/couple-supplier-notices.ts`, kept off the email allowlist.
- `lib/schedule-shift-notice.ts` (the words, from the first moved moment's stored wall clock — never converted) and
  `lib/schedule-shift-notify.server.ts` (booked shops' owners, once per person, never the person who pressed it;
  best-effort — the shift is already written).
- `bulkRetimeScheduleBlocks` notifies once after its write loop, only when the Running-late sheet sends
  `shift_notice` (a drag of one moment rides the same action and is not a shift of the day); `floorRetimeFrom`
  always does.
- Where it opens: on the event day, the live console at `#schedule` (new `id` on the always-drawn clock block); any
  other day the console redirects to the Hub list, so the notice opens the customer card (where the day-of timeline
  is) instead — a call made here, flagged in the PR.

Guard: `lib/a-schedule-shift-tells-every-booked-supplier.test.ts`.

SPEC IMPACT: DECISION_LOG row (owner YES 2026-10-23) — recorded with the march row.
