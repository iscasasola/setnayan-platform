## 2026-11-14 · fix(walk): round 9 — never-fixed supplier findings (F-W1-30 · F-W1-47)

- **F-W1-30** The supplier's Booking fees page says the launch offer while it runs ("Launch offer · Setnayan's first
  N bookings are free — M still open."), read from the live `platform_settings` (`launchOfferFeesLine`); closed, unset
  or unreadable → nothing about it.
- **F-W1-47** A client whose couple named ONE candidate day files under that day in the Clients list (Group by day,
  Sort by date) instead of "No date yet" beside a row that names its day (`onlyCandidateDay`, `clientFilingDate`).
- Guard: `apps/web/lib/the-walk-round-9.test.ts`.

SPEC IMPACT: None.
