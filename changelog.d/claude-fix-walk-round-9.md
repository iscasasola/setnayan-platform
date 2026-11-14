## 2026-11-14 · fix(walk): round 9 — never-fixed supplier findings (F-W1-30 · F-W1-47)

- **F-W1-30** The supplier's Booking fees page says the launch offer while it runs ("Launch offer · Setnayan's first
  N bookings are free — M still open."), read from the live `platform_settings` (`launchOfferFeesLine`); closed, unset
  or unreadable → nothing about it.
- **F-W1-47** A client whose couple named ONE candidate day files under that day in the Clients list (Group by day,
  Sort by date) instead of "No date yet" beside a row that names its day (`onlyCandidateDay`, `clientFilingDate`).
- **RW-59** (carried from round 7) A recognised guest on an event dated only by its one picked day saw "Confirm
  attendance" on the Hub, then "Replies are not open yet" on the reply page. The Hub dated the event by that day
  (`withPickedDate`); the reply page read the raw row with no date. `replyWindow` now applies `withPickedDate` itself, and
  its columns carry `date_candidates`, so every reader gives one answer.
- Guard: `apps/web/lib/the-walk-round-9.test.ts`.

SPEC IMPACT: None.
