## 2026-11-02 · fix(coordinator): a booked coordinator is told, in the app, that their invite is waiting

Supplier gate audit 2026-11-02, row E1 (BROKEN): `autoInviteCoordinator` (`lib/coordinator-grant.ts`) made a 7-day
`/host/accept/<token>` invite the moment a planner_coordinator booking was paid — and told nobody; the couple had to copy
the link by hand.

- A NEW invite now sends `coordinator_invited` (enum value in `20271303211103`; in the app only, NOT on the email
  allowlist) to the account whose email IS the invite's — the booked shop's owner first when it is that account
  (`lib/coordinator-invite-notice.ts`). The accept page refuses any other email, so no other account is told; no
  matching account → nobody is told here (the couple's Promote card still shows the link). The notice opens the invite's
  own accept link. A re-marked payment that finds the invite already there tells nobody again.
- The paid-booking caller (`app/dashboard/[eventId]/vendors/actions.ts`) passes the booked shop through.
- Guard: `lib/a-booked-coordinator-is-told.test.ts`.

Not changed: the coordinator still ACCEPTS — no seat is granted without their yes (the audit's "seat them directly" is
an owner call, point 9). The `coordinator_requests_inbox` control is untouched (seeded `inactive` by
`20271013100000_day_of_requests_stream.sql`, `ON CONFLICT DO NOTHING`, never changed by a later migration; production's
value is set in Admin › Data privacy and was not read).

SPEC IMPACT: None.
