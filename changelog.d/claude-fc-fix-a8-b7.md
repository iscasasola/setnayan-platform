## 2026-11-25 · fix(admin): the admin area limits are held on the server (final check area 8, batch 7)

- Deletions · Escalated is asked before a deletion request is marked approved or rejected, and before an event is
  removed (the queue, its rejection, and Accounts › Events › Delete). The self and internal-account guards run
  before anything is written; an unreadable target is refused (fail closed), never erased.
- Removing an event stops when its unpaid bills could not be cancelled; a failed "answered" mark is said.
- A supplier invite that carries a free paid plan asks Plans · Escalated, like Set tier.
- Every price write (booking fee, Papic ladder and prices, sign-up discount, event-type bands, AI bands, sizing,
  free windows) asks Prices & promos · Escalated.
- Catalogue · Escalated is enforced for hide for everyone, combine (remove a category into another) and retire.
- The money desks ask their area: payouts (mark paid = Payments · Escalated, hold = Payments · Basic), plan
  confirmations (Payments · Basic), founder seats (Gifts & comps · Escalated), launch offer and booking-fee switches
  (Prices & promos · Escalated), supplier payment destinations (Verification · Escalated).
- A resolved force-majeure flag can no longer be re-resolved; disconnecting a live-studio channel is refused when
  its status can't be read.
- Guard: `apps/web/app/admin/admin-area-gates-hold.test.ts` (ordered: each gate before the read or write it guards).
- Findings: A8·D-1 A8·D-2 A8·D-3 A8·D-4 A8·D-5 A8·B-2 A8·L-8 A8·E-2 A8·F-17.

SPEC IMPACT: None. No amount, fee, plan content or sign-in rule changes; the server now holds the area limits the
Team grid already shows.
