## 2026-11-25 · fix(plan pages): a failed read says so, never "none" (final check, area 2, batch 1)

The staging walk found the couple's planning pages drawing a refused read as a confident absence. Each page now
branches on the read's own error and draws the shared `ReadRefusedNotice` instead of its empty state. No layout change.

- Access requests: "Nothing waiting on you." only when both lists were read (A2-E7).
- Disputes: flags and booked suppliers each say when they could not load (A2-G15).
- Manpower: one refusal line, never three empty gig groups (A2-H5).
- Sponsors: stops at the refusal; no "0 of N slots" with Add buttons over sponsors already there (A2-I13).
- Find your date: a failed date read never says "set your dates first" (A2-H15).
- Who is here: a failed who-are-you read never says "not shared with you" (A2-E8).
- Activity: `fetchEventActivityMeasured` names refused sources; never "Nothing has happened yet" over them (A2-B9).
- Check-in and souvenir desks: never drawn from a refused guest read (A2-D13, A2-E2).
- Contracts: `readEventContracts`; the detail page uses the honest `readContract`, 404 only on an answered miss (A2-G14).
- Paperwork: `readEventPaperwork`; never "Start your checklist" over a refusal (A2-I8); a non-wedding event gets one
  plain line and a door to Documents instead of a blank page (A2-I9).
- Documents: no `.catch(() => [])`; receipts' error is read; never "No documents yet" over a refusal (A2-I5).
- Find: a refused category search says so with Try again, never "0 suppliers" (A2-G10).

Guard: `app/dashboard/[eventId]/the-plan-pages-say-when-a-read-failed.test.ts`.

SPEC IMPACT: None (honest states per CLAUDE.md §5 rule 4; no rule, price or flow changes).
