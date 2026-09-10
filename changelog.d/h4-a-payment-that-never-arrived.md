## 2026-09-11 · feat(payments): a supplier can say a logged payment never arrived — one path for every payment

Owner ruling, 2026-09-11 (DECISION_LOG "NOT RECEIVED USES ONE PATH FOR EVERY
PAYMENT"): the deposit keeps its existing path; installments get the same one,
refereed on the same disputes page; and confirming a deposit in the chat also
confirms it on the booking, so the two can never disagree. Register session H4.

**Before this change,** the downpayment already had the whole path:
`reject_vendor_deposit` → `/admin/disputes` → `settle_vendor_deposit_dispute`.
Installments had no refusal at all. The deposit is also a row on the payments
ledger, and confirming that row never acknowledged the deposit, so one sum could
carry two different supplier answers.

**Migration `20271222394035_a_payment_can_be_refused_too.sql`:**
- `event_vendor_payments.is_deposit_record`: the database stamps the row the
  couple's deposit wrote, once, at insert. It matches the two exact notes the
  deposit writers use, only after the booking has a recorded deposit, and only
  once per booking. No session can set or change it.
- The deposit's refusal and settlement columns are mirrored onto the ledger for
  installments. Two CHECKs back them: a row can't be both confirmed and refused,
  and the deposit's row never carries a refusal of its own.
- The ledger's guard now runs on `BEFORE INSERT OR UPDATE`. This also closes the
  INSERT hole that `20271008178212` recorded as "known, not fixed": a couple
  could insert a row that was already vendor-confirmed.
- `refuse_vendor_payment`: the deposit's row delegates to
  `reject_vendor_deposit`; an installment is marked on its own row.
- `confirm_vendor_payment`: confirming the deposit's row acknowledges the
  deposit, and confirming an installment clears its refusal.
- A trigger confirms the deposit's row whenever the deposit is acknowledged,
  whether from its own card or by Setnayan settling "the payment stands".
- `settle_vendor_payment_dispute`: an admin-only referee for installments.

**App:**
- **Supplier, payment section:** "Not received" with an optional reason, through
  a shared `NotReceivedForm`. A refused payment shows the supplier's words, then
  Setnayan's ruling. "It arrived — confirm received" stays available.
- **Supplier, Decisions:** the same two answers.
- **Couple, Decisions:** the line quotes the supplier's words, then Setnayan's
  note. A refused payment asks neither side anything.
- **Admin:** `/admin/disputes` has a second section for installments, and the
  work-queue badge counts them.
- A refused installment reads "due" in the plan stepper, not "pending". The
  supplier's client page no longer counts it as "awaiting your confirmation".

**Guards:**
- `tests/db/a-payment-can-be-refused-too.db.test.ts`: 17 cases, by behaviour
  under the real roles. It was mutation-checked 6 ways against sabotaged SQL.
- `lib/a-payment-can-be-refused-too.test.ts` covers:
  - the refusal read;
  - the Decisions lines;
  - the stepper;
  - a pin between the deposit writers' notes and the database's list,
    mutation-checked from both sides;
  - one definition of "open" shared by the admin page and its badge;
  - the admin-session rule.
- `a-decision-reply-posts-what-the-action-reads` now checks each payment action
  against its own form, at both doors.
- `gates-have-handles` detector fix: it missed any assignment that ended its
  line, and PL/pgSQL `:=`. No baseline line changed status.

SPEC IMPACT: None in this PR. The ruling is recorded in the corpus
`DECISION_LOG.md` (2026-09-11, question 9), and the orchestrator owns H4's
status in `WHATS_NEXT_Build_SEQUENCE_2026-09-10.md`.
