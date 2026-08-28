## 2026-08-28 · feat(admin-payments): the reconciliation card says what it approves

The owner looked at a real pending payment and could not decide from it: *"we
should also know what they ordered and what event and what they will get"* ·
*"used a discount. what they get. the amount that should be sent."* · and, on
the always-on duplicate checkbox, *"i don't have any basis to know if it
matched so i cannot approve it."*

Each pending-payment card now carries:

- **The itemised bill.** An onboarding basket lists its own lines (catalog
  titles, the customer pay page's shape) via the one existing authority for
  basket lines — no second read. A one-product order shows its catalog title.
  A bill that cannot be read says so instead of rendering blank.
- **Which celebration** — name, type, date (a NULL date reads "no date set",
  never a blank), with a link to the event. Not-event-scoped reads as intent;
  a failed read says "could not read".
- **The money, top to bottom** — what each line normally costs (Setnayan AI's
  regular price resolved per event type), the sign-up discount taken off, any
  voucher, AMOUNT TO SEND (computed by the same `orderGrossOwed` arguments the
  approval shortfall guard uses — never a second figure), what they
  transferred, and whether it covers exactly / is short / is over, on the
  guard's own tolerance.
- **The duplicate checkbox only when there is a duplicate.** Derived by the
  same `classifyDuplicate` rule `approvePaymentCore` consults; when it renders
  it names the other order and the amount counted there. A same-order collision
  shows the no-override refusal instead. A collided row is excluded from
  one-click/batch so it routes through the informed confirm form. A clean card
  shows no checkbox at all.

Receipt-OCR ("detect the amount from the screenshot") is deliberately NOT here
— it is built in PR #4947, held as a draft on the owner/DPO subprocessor-wording
ruling.

Guard: `app/admin/payments/the-desk-says-what-it-approves.test.ts` (16 tests,
mutation-proved — counts in the PR body).

SPEC IMPACT: None (admin console rendering only; no schema, no price, no rule
change — every money figure derives from the existing guard's own computation).
