## 2026-09-19 · fix(chat): the accepted quote card locks in place, and the supplier can answer it there — both ends of one connection

Owner, live as the couple: *"the lock attempt was from the chat. it should also
work there."* The accepted quote card's "🔒 Ask <shop> to lock" was a link (to
the workspace, then to the bench in #5677); nothing was written from the chat.
Owner, live as the supplier: the same card read "Accepted · the couple has asked
you to lock" with only "View proposal" — *"there is no agree and confirm booking"*.

- **Couple's card** now MOUNTS the bench's own `AccordionLockButton` (the same
  component `bench-vendor-actions.tsx` and `build-locked.tsx` mount), so the one
  `finalizeVendor` runs with its confirm step, lock-impact text, slot / terms /
  downpayment gates and error lines. The target comes from a new
  `coupleLockTarget` in `lib/lock-door.ts` (same `planGroupForCategory` as the
  bench); a category no plan group claims falls back to the bench link.
- **`AccordionLockButton` had no case for `'lock_requested'`** — the handshake
  ask fell through the switch and the button sat idle, identical to a press that
  did nothing (the bench hid it only because its own revalidation swapped Lock for
  Withdraw). It now says "Lock requested — waiting for <shop> to agree.", calls
  `router.refresh()` (the chat page is not in `finalizeVendor`'s revalidatePath),
  and a `never` default turns any unnamed status into a visible error — which
  at once found a second silent one, `'not_secured'` (a guest session), now named.
- **Supplier's card** now mounts Agree / Turn it down (`LockAnswerForms`) when the
  ask is open (`quoteCardState.offerLockAnswer`), posting the SAME
  `vendorAgreeToLock` / `vendorDeclineLock` the Overview posts. They carry
  `return_to`; `lockAnswerReturnTo` (allowlist: a supplier thread path only)
  sends the answer back to the thread, which renders the `lock-answer-notice`
  sentence (refusals as `role="alert"`). Without `return_to` they still land on
  the Overview as before.
- Guards: new `lib/the-chat-card-locks-in-place.test.ts` (both ends mount the one
  mechanism, no new ask-writer, the return path is executed); updated
  `a-revised-quote-must-be-accepted-again`, `every-door-off-the-frame-lands-elsewhere`,
  `lock-door`. Each new assertion sabotaged once and seen red.

⚠ "Exactly one lock action" is not true of the codebase and is not claimed: four
TypeScript writers set `lock_request_state = 'pending'` (finalizeVendor, package
lock, wizard, chat amendment `lockDeal`). The guard pins that set so the chat
card could not add a fifth.

SPEC IMPACT: None — reuses shipped actions; no schema, price or flow change.
