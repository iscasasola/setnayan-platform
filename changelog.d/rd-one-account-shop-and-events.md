## 2026-10-22 · feat(accounts): one account is both — a shop account creates its own events

Owner 2026-10-22, verbatim: *"Why does the user cannot make events anymore. In
shop they do not create events, but them as a user, they can create their
events"*, then *"Yes to all"* to Supplier 1 · Option B of
`Setnayan/prototypes/journey_fixes_2026-10-22.html`.

- `lib/vendor-event-creation.ts`: the one creation gate stays one function
  (`shopAccountMayNotCreateEvents` → `accountMayNotCreateEvents`) and now refuses
  nobody, without a database read. Every events-insert door still calls it —
  and the wedding wizard (`commitOnboardingWedding`), which the 2026-08-15
  roster had missed, now does too.
- The "sign up with a personal account using a different email" refusal, its
  `shop_account` error code and `lib/vendor-event-creation-copy.ts` are gone.
- `lib/roles.ts`: `hasCustomerAccess` is true for every account (was
  `account_type !== 'vendor'`).
- The shop side (Today · Customers · Shop · Hub) still never offers "create
  event" — now held by a guard.
- Every supplier permission and RLS policy is unchanged; a supplier still holds
  no `events` RLS on a customer's event.

Guard: `apps/web/lib/vendor-event-creation.test.ts`, turned around on purpose
(it pinned the superseded rule): every `events` insert asks the gate first
(found by scan, not roster) · the gate refuses no shop owner, team member or
customer and reads nothing · the refusal copy and code are gone · the role
summary gives everyone their events · no supplier page links to a create door.

SPEC IMPACT: DECISION_LOG.md 2026-10-22 "ONE ACCOUNT IS BOTH" — supersedes the
2026-08-15 ruling ("they cannot make from their vendor account"; keep both,
block only creating).
