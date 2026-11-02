## 2026-09-20 · fix(money): one "Amount to pay" door, the next payment on every surface, and a revised quote keeps its schedule

Follow-ups to #5717, plus the owner's live points of 2026-09-20: "i think it is
better to say amount to pay. since this is not just for the downpayment but
also for the next payments" and, on the booked chat quote card, "i do not see
the confirmation here and the payment action?"

- **One payment door.** "Record deposit" and "+ Log a payment" both inserted
  into `event_vendor_payments`; only the first held the date and marked the row
  as the deposit, so a first payment through the log was never a deposit, and
  recording it afterwards counted it twice. For a Setnayan supplier the couple
  now has ONE visible control, "Amount to pay" (the existing deposit card,
  relabelled). It names the payment that is due: the first payment
  (`recordDeposit`, minimum enforced), then the next installment from the quote,
  prefilled with no minimum (`logScheduledPayment`, which runs `logPayment`).
  The itemization card's log points there. On the server, `decideLogPayment`
  sends a first payment back to the deposit, and `decideDepositRecord` refuses
  to record a deposit on top of money already logged. It also now holds the
  "re-record adds no second row" rule. Off-platform suppliers keep the log.
- **The lock downpayment follows the same minimum** (`finalizeVendor`,
  `decideDepositAmount`). The modal prefills the on-lock first payment.
- **/budget** shows the accepted quote's lines and total instead of "hasn't
  shared pricing yet" for a quote-locked supplier.
- **Revised quotes keep the schedule.** "Update this quote" reset the
  builder's schedule to 20% on lock plus a 14-day balance: the seed never read
  `payment_schedule`, and `ProposalMaker` ignored `revision`. Now
  `seedScheduleFromStored` carries it forward, and the dup-rule baseline line
  is gone.
- **The next money step, both ends.** `moneyStep` + `moneyStepLine` (pure) and
  `readBookedMoney` (I/O). On a booked accepted quote, the chat card now shows
  "First payment ₱3,350 — due now", with the couple's Amount to pay card
  mounted there. The supplier sees "₱3,350 recorded by the couple" with the
  payment card's own Confirm (`confirmVendorPayment`). The price line no longer
  reads "Accepted · Accepted · booked". The supplier's client page names the
  next installment too.
- **Booked proposal page.** It says it is booked, shows the next step, and
  links to Amount to pay. The default note's "nothing is booked or paid until
  you Lock" is dropped once booked (`quoteNoteShown`; `lib/proposal-send.ts`
  imports the same sentence).

Guard: `lib/amount-to-pay.test.ts`. It includes an exhaustive run of both
doors in every order (up to four presses): never two deposit rows, and never a
deposit recorded after money was already logged. Two existing guards were
updated to the owner's new wording, with the same properties: `deposit-pay-step.test.ts`
("Record payment", `payDue`).

SPEC IMPACT: None. This is copy and wiring on existing rules. The owner's
"Amount to pay" wording is recorded here and in the code.
