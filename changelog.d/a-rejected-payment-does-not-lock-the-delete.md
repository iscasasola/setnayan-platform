## 2026-09-30 · fix(events): a rejected payment no longer locks a celebration against removal

Reported: *"i tried deleting Movie night … and it did not work"*.

**The database side was checked and is not the cause.** A celebration with rows in
127 of the 210 tables that hang off `events`, deleted the way `deleteOwnEvent` deletes
it, is removed cleanly in the migration replay — no FK, trigger or composite-key refusal.

**The app's money gate had a hole.** `getEventDeletionImpact` counted **every**
`payments` row as blocking, then named the block by counting `matched` and `pending`
separately. `payment_status` has four values — `pending · matched · rejected ·
resubmit_requested` — so a celebration whose only payment was **rejected**, or sent back
for a **re-upload**, was blocked while `blockKind` found nothing to name. The panel then
fell back to *"We couldn't check what's been paid for on this celebration"* — false,
since the read succeeded — and, as the "unreadable" case, offered **no "Ask us to remove
it" button**. A permanent dead end, and it contradicted the code's own comment that a
rejected payment "must not hold somebody's celebration hostage".

- New pure helper `tallyPayments` (`lib/event-deletion-gate.ts`) sorts the statuses in
  one pass: `rejected` holds nothing; `matched` blocks as settled; everything else —
  `pending`, `resubmit_requested`, and any status added later — blocks as *still being
  checked*, with the ask-us door.
- The impact read now reads payment statuses once and uses the helper (one query in
  place of three). A failed read still leaves the gate null → blocked.
- Safe: payments has no UPDATE policy for a couple, so only an admin can make a payment
  `rejected` — this does not reopen the cancel-a-paid-order hole the gate was built for.
- Tests: unit tests for the helper, plus an invariant that every blocking payment mix is
  described as `settled` or `awaiting_check`; the source guard now pins the helper and
  forbids per-status payment filters coming back.

⚠ **Not confirmed against production.** This session has no prod DB access, so it cannot
say that Movie Night's block is this one. To check:
`select p.status from payments p join orders o using (order_id) join events e using (event_id) where e.display_name ilike 'movie night';`
Any `rejected` / `resubmit_requested` row there is this bug. A `matched` row or a paid
order is the gate working as designed ("Ask us to remove it").

SPEC IMPACT: None
