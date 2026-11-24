## 2026-11-23 · feat(booking fee): a free booking fee only on "For you" events, locked once a supplier joins

The owner's money rule (specs DECISION_LOG 2026-11-23, "Free booking fee only on 'For you' events, locked once a supplier joins"): *"you can only get free booking fee if the event is for self (you are the celebrant) once a supplier comes in, it is locked that way."* It closes the game where someone creates an event for another person, picks the free path, and the supplier never pays.

- **Migration `20271360986087_free_booking_fee_only_for_you_events_locked_once_a_supplier_joins.sql`:**
  - `events.for_whom` (`self` · `someone` · `memorial` · `business`, the shipped "For ▾" words; NULL = never recorded). The event never stored the answer before: "For you" lived only in sessionStorage, and a blank honoree is also what "Someone else" leaves when the name is skipped. `authenticated` and `anon` get no grant on it.
  - Backfill for weddings only: the creator's own host row says bride or groom (→ `self`) or family helper (→ `someone`). Every other existing event stays NULL and pays on the free paths.
  - `booking_fee_event_is_for_you(event)`: the one reader (service role only).
  - Trigger `events_for_whom_locked`: once any `event_vendors` row exists, any change to `for_whom` is refused, for every role.
  - `booking_fee_open_lock_charge` re-created: the import, the launch offer, a free-fee window, the every-Nth booking fee and a free booking fee ticket each waive only on a For-you event. A live waived charge, a place frozen free and a launch place already held are never taken back. The attribution is unchanged (`import` stays `import`, so #8227's proof readers are unaffected). The amendment path is untouched.
- **TS twin:** `decideLockFee` takes `forYou` (and `launchOfferHeld`), arm for arm with the SQL. `lib/event-for-whom.ts` holds the stored answer's rules.
- **The supplier's fee preview** (`resolveBookingFeeStanding`) asks the same reader. It never says "free" for an event made for someone else, and an unreadable answer is "unreadable".
- **Every create path records the answer:** the create grid's inline form, `/onboarding/[type]` (the wizard, including the types that ask no celebrant), `/onboarding/simple`, and the wedding (from "Which one is you?"). "For you" next to a typed name, a linked person or a group is stored as `someone`.
- Guards:
  - `tests/db/free-fee-only-for-you-events.db.test.ts`: every free path × every answer, with SQL and TS compared reason for reason, plus the lock. 2 SQL sabotages, each red.
  - `lib/free-fee-only-for-you.test.ts`: the pure rules, plus a check that only the create paths write `for_whom`. 1 sabotage, red.
  - 13 existing fee DB tests now build their fixture events as "For you", because they test the free paths themselves.
- Server actions: no new export.

SPEC IMPACT: None new. It builds the 23 Nov DECISION_LOG row as written. One open call is surfaced to the controller: non-wedding events made before 23 Nov never recorded the answer, so they pay on every free path.
