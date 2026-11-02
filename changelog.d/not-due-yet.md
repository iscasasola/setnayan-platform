## 2026-09-20 · fix(money): "nothing due now" is its own state, paying early is a choice, and what was paid is on screen

Owner, live as testnayan4 on the booked Saysay card, 2026-09-20: *"after paying.
their next due date is not yet today, so there is nothing to record. Pay in
advance? show the current payments done as well."*

₱3,350 had been recorded on Sep 20 and confirmed by the supplier; the next
installment is the ₱13,400 Final balance due **Feb 27, 2027**. The card still
read `Final balance · due Feb 27, 2027 · ₱13,400` beside a prominent **Record
payment** button, and showed no trace of the ₱3,350 — "₱13,400 is owed today"
and "nothing is owed today" rendered identically, and a booking paid into
looked like one that was not.

- `lib/accepted-quote-terms.ts` — `installmentDueISO` + `QuoteScheduleRow.dueOnISO`
  give each installment a comparable `YYYY-MM-DD`; `installmentDueState` decides
  due now / not due yet / overdue by STRING comparison against `manilaToday()`
  (never `new Date('2027-02-27')`, which is the 26th in Manila). `moneyStep`
  gains the kind `installment_not_due_yet` and `installment_due.overdue`;
  `moneyStepLine` speaks both, for both ends. Either unknown (no date, no clock)
  falls back to due now — a payment door is never hidden on a date we cannot
  establish.
- `lib/payment-history.ts` (new, pure) + `app/_components/payment-history-list.tsx`
  (new) — "Payments so far": date, amount, method, whether the supplier
  confirmed it, and `₱3,350 paid of ₱16,750 · ₱13,400 remaining`. A refused
  ledger read is `{ state: 'unreadable' }` with its own sentence — NEVER "no
  payments recorded yet", the sentence that is byte-identical to a booking
  nobody has paid into (#5724's rule, applied to money).
- `lib/booked-money-step.server.ts` — one reader for both ends: selects
  `paid_at, method, payment_refused_at`, stamps `today: manilaToday()`, and
  keeps a refused ledger read as `null`, never `[]`.
- Couple: the "Amount to pay" card shows the not-due-yet line and a quieter
  **Pay early** control that opens the SAME `logScheduledPayment` form,
  prefilled — one payment path, not two. Renders on the Payments tab and inside
  the chat quote card (which mounts the same card).
- Supplier: the client page and the chat quote card read the same step and the
  same history, from the same helper.

GUARD: `lib/not-due-yet.test.ts` executes the five states (due now · not due yet
· overdue · all paid · unreadable), pins the mounts on both ends, and proves a
failed payments read never renders as zero payments. Sabotage-proven.

SPEC IMPACT: None — no schema, no price, no locked decision changed.
